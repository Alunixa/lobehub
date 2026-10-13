// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProactiveConversationModel } from '@/database/models/proactiveConversation';

import { dispatchProactiveConversations } from './dispatch';

vi.mock('@/database/server', () => ({ getServerDB: vi.fn().mockResolvedValue({}) }));
const execute = vi.hoisted(() => vi.fn());
const findTopic = vi.hoisted(() => vi.fn());
const findMessage = vi.hoisted(() => vi.fn());
vi.mock('@/database/models/message', () => ({
  MessageModel: class {
    findById = findMessage;
  },
}));
vi.mock('@/database/models/topic', () => ({
  TopicModel: class {
    findById = findTopic;
  },
}));
vi.mock('@/server/services/aiAgent', () => ({
  AiAgentService: class {
    execAgent(...args: unknown[]) {
      return execute(...args);
    }
  },
}));
afterEach(() => vi.restoreAllMocks());

describe('server-side autonomous dispatch', () => {
  const plan = { id: 'plan', sourceMessageId: 'answer', decision: { idleForSeconds: 731 } };
  it('runs only the claimed plan without persisting a fake human message', async () => {
    vi.spyOn(ProactiveConversationModel, 'listDue').mockResolvedValue([
      { id: 'topic', userId: 'user', workspaceId: null },
    ]);
    vi.spyOn(ProactiveConversationModel.prototype, 'claim').mockResolvedValue(plan as never);
    findTopic.mockResolvedValue({ agentId: 'agent' });
    const mark = vi.spyOn(ProactiveConversationModel.prototype, 'mark').mockResolvedValue();
    execute.mockResolvedValue({ success: true, operationId: 'operation' });
    await dispatchProactiveConversations();
    expect(mark).toHaveBeenCalledWith('topic', 'plan', 'running', 'operation');
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        suppressUserMessage: true,
        disableLocalSystem: true,
        appContext: expect.objectContaining({ topicId: 'topic', proactivePlanId: 'plan' }),
      }),
    );
  });
  it('does not call the model when the plan was cancelled or claimed by another scanner', async () => {
    vi.spyOn(ProactiveConversationModel, 'listDue').mockResolvedValue([
      { id: 'topic', userId: 'user', workspaceId: null },
    ]);
    vi.spyOn(ProactiveConversationModel.prototype, 'claim').mockResolvedValue(undefined);
    findTopic.mockClear();
    await dispatchProactiveConversations();
    expect(findTopic).not.toHaveBeenCalled();
  });
  it('dispatches a legacy topic using its own assistant source identity', async () => {
    vi.spyOn(ProactiveConversationModel, 'listDue').mockResolvedValue([
      { id: 'topic', userId: 'user', workspaceId: null },
    ]);
    vi.spyOn(ProactiveConversationModel.prototype, 'claim').mockResolvedValue(plan as never);
    vi.spyOn(ProactiveConversationModel.prototype, 'mark').mockResolvedValue();
    findTopic.mockResolvedValue({ agentId: null });
    findMessage.mockResolvedValue({ topicId: 'topic', agentId: 'legacy-agent', role: 'assistant' });
    execute.mockClear();
    execute.mockResolvedValue({ success: true, operationId: 'legacy-operation' });
    await dispatchProactiveConversations();
    expect(findMessage).toHaveBeenCalledWith('answer');
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'legacy-agent' }));
  });
  it('does not use a source message from a different topic to dispatch', async () => {
    vi.spyOn(ProactiveConversationModel, 'listDue').mockResolvedValue([
      { id: 'topic', userId: 'user', workspaceId: null },
    ]);
    vi.spyOn(ProactiveConversationModel.prototype, 'claim').mockResolvedValue(plan as never);
    const mark = vi.spyOn(ProactiveConversationModel.prototype, 'mark').mockResolvedValue();
    findTopic.mockResolvedValue({ agentId: null });
    findMessage.mockResolvedValue({
      topicId: 'different',
      agentId: 'wrong-agent',
      role: 'assistant',
    });
    execute.mockClear();
    await dispatchProactiveConversations();
    expect(execute).not.toHaveBeenCalled();
    expect(mark).toHaveBeenCalledWith('topic', 'plan', 'failed');
  });
});
