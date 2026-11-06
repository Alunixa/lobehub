import { describe, expect, it } from 'vitest';

import { buildHelperMaps } from '../indexing';
import { parse } from '../parse';
import { Transformer } from '../transformation';
import type { Message } from '../types';

const createMessage = (
  id: string,
  role: Message['role'],
  parentId: string | undefined,
  createdAt: number,
): Message => ({
  agentId: 'agent',
  content: id,
  createdAt,
  id,
  parentId,
  role,
  updatedAt: createdAt,
});

function createToolTurns(count: number, singleRun = false): Message[] {
  const messages: Message[] = [];
  let parentId: string | undefined;
  for (let index = 0; index < count; index++) {
    if (!singleRun || index === 0) {
      const user = createMessage(`user-${index}`, 'user', parentId, messages.length);
      messages.push(user);
      parentId = user.id;
    }
    const assistant = createMessage(`assistant-${index}`, 'assistant', parentId, messages.length);
    const toolId = `tool-${index}`;
    assistant.tools = [
      { apiName: 'read', arguments: '{}', id: toolId, identifier: 'test', type: 'default' },
    ];
    const tool = createMessage(toolId, 'tool', assistant.id, messages.length + 1);
    tool.tool_call_id = toolId;
    messages.push(assistant, tool);
    parentId = tool.id;
  }
  messages.push(createMessage('latest-message', 'user', parentId, messages.length));
  return messages;
}

describe('long conversation traversal', () => {
  it('parses deep ordinary history without truncating messages or mutating input', () => {
    const messages = Array.from({ length: 12_000 }, (_, index) =>
      createMessage(
        `message-${index}`,
        index % 2 === 0 ? 'user' : 'assistant',
        index === 0 ? undefined : `message-${index - 1}`,
        index,
      ),
    );
    const before = JSON.stringify(messages);

    const result = parse(messages);

    expect(result.flatList.map((message) => message.id)).toEqual(
      messages.map((message) => message.id),
    );
    expect(result.contextTree).toHaveLength(messages.length);
    expect(Object.keys(result.messageMap)).toHaveLength(messages.length);
    expect(JSON.stringify(messages)).toBe(before);
  }, 20_000);

  it('flattens thousands of tool turns and retains the newest user message', () => {
    const messages = createToolTurns(1_800);
    const transformer = new Transformer(buildHelperMaps(messages));

    const flatList = transformer.flatten(messages);

    expect(flatList.filter((message) => message.role === 'user')).toHaveLength(1_801);
    expect(flatList.filter((message) => message.role === 'assistantGroup')).toHaveLength(1_800);
    expect(flatList.at(-1)?.id).toBe('latest-message');
  }, 20_000);

  it('parses one long tool-using run without losing tool results or its follow-up', () => {
    const messages = createToolTurns(2_500, true);

    const result = parse(messages);

    expect(result.flatList).toHaveLength(3);
    expect(result.flatList[1].role).toBe('assistantGroup');
    expect(result.flatList[1].children).toHaveLength(2_500);
    expect(result.flatList.at(-1)?.id).toBe('latest-message');
    expect(Object.keys(result.messageMap)).toHaveLength(messages.length);
    expect(result.messageMap['tool-2499'].tool_call_id).toBe('tool-2499');
  }, 20_000);
});
