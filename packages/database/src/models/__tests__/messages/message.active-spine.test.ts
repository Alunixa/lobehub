import { parse } from '@lobechat/conversation-flow';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../../core/getTestDB';
import { messages, threads, topics, users } from '../../../schemas';
import { MessageModel } from '../../message';

const db = await getTestDB();
const userId = 'active-spine-user';
const otherUserId = 'active-spine-other';
const topicId = 'active-spine-topic';
const model = new MessageModel(db, userId);

const row = (
  id: string,
  role: string,
  seconds: number,
  parentId?: string,
): typeof messages.$inferInsert => ({
  content: id,
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, seconds)),
  id,
  parentId,
  role,
  topicId,
  userId,
});

beforeEach(async () => {
  await db.insert(users).values([{ id: userId }, { id: otherUserId }]);
  await db.insert(topics).values({ id: topicId, userId });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, userId));
  await db.delete(users).where(eq(users.id, otherUserId));
});

describe('MessageModel.getActiveSpineMessageId', () => {
  const seedBranches = async () => {
    await db.insert(messages).values([
      { ...row('root', 'user', 0), metadata: { activeBranchIndex: 0 } },
      row('selected-answer', 'assistant', 1, 'root'),
      row('inactive-answer', 'assistant', 2, 'root'),
      row('hidden-user', 'user', 3, 'inactive-answer'),
      row('hidden-answer', 'assistant', 4, 'hidden-user'),
    ]);
  };

  it('keeps a follow-up visible when a newer regenerated branch is inactive', async () => {
    await seedBranches();

    expect(await model.getLatestSpineMessageId({ topicId })).toBe('hidden-answer');
    const parentId = await model.getActiveSpineMessageId({ topicId });
    expect(parentId).toBe('selected-answer');

    await db.insert(messages).values(row('follow-up', 'user', 5, parentId));
    const { flatList } = parse(await model.query({ topicId }));
    expect(flatList.some((message) => message.id === 'follow-up')).toBe(true);
    expect(flatList.some((message) => message.id === 'hidden-user')).toBe(false);
  });

  it('follows a changed branch selection instead of forcing the older branch', async () => {
    await seedBranches();
    await db.update(messages).set({ metadata: { activeBranchIndex: 1 } })
      .where(eq(messages.id, 'root'));

    expect(await model.getActiveSpineMessageId({ topicId })).toBe('hidden-answer');
  });

  it('uses the same inferred branch as the conversation parser without explicit metadata', async () => {
    await seedBranches();
    await db.update(messages).set({ metadata: null }).where(eq(messages.id, 'root'));

    expect(await model.getActiveSpineMessageId({ topicId })).toBe('hidden-answer');
  });

  it('returns a real assistant id for a tool group, never its inline tool result', async () => {
    await db.insert(messages).values([
      row('root', 'user', 0),
      {
        ...row('tool-assistant', 'assistant', 1, 'root'),
        tools: [{
          apiName: 'search', arguments: '{}', id: 'tool-call', identifier: 'test',
          result_msg_id: 'tool-result', type: 'builtin',
        }],
      },
      row('tool-result', 'tool', 2, 'tool-assistant'),
      row('final-assistant', 'assistant', 3, 'tool-assistant'),
    ]);

    expect(await model.getActiveSpineMessageId({ topicId })).toBe('final-assistant');
  });

  it('does not anchor a user turn to a toolless signal callback', async () => {
    await db.insert(messages).values([
      row('main-answer', 'assistant', 1),
      {
        ...row('callback', 'assistant', 2),
        metadata: { signal: { type: 'monitor' } },
      },
    ]);

    expect(await model.getActiveSpineMessageId({ topicId })).toBe('main-answer');
  });

  it('uses a physical spine message behind an inline task card, not a virtual or tool id', async () => {
    await db.insert(messages).values([
      row('root', 'user', 0),
      row('task-tool', 'tool', 1, 'root'),
      row('async-task', 'task', 2, 'task-tool'),
      row('async-task-2', 'task', 3, 'task-tool'),
    ]);

    const { flatList } = parse(await model.query({ topicId }));
    expect(flatList.some((message) => message.role === 'tasks')).toBe(true);
    expect(await model.getActiveSpineMessageId({ topicId })).toBe('root');
  });

  it('returns the actual assistant id when the selected tail is a tool-only group', async () => {
    await db.insert(messages).values([
      row('root', 'user', 0),
      {
        ...row('tool-only-assistant', 'assistant', 1, 'root'),
        content: '',
        tools: [{
          apiName: 'search', arguments: '{}', id: 'tool-only-call', identifier: 'test',
          result_msg_id: 'tool-only-result', type: 'builtin',
        }],
      },
      row('tool-only-result', 'tool', 2, 'tool-only-assistant'),
    ]);

    expect(await model.getActiveSpineMessageId({ topicId })).toBe('tool-only-assistant');
  });

  it('isolates the main conversation from a newer thread and resolves the thread tail', async () => {
    await db.insert(messages).values(row('main-answer', 'assistant', 0));
    await db.insert(threads).values({
      id: 'active-spine-thread', sourceMessageId: 'main-answer',
      topicId, type: 'standalone', userId,
    });
    await db.insert(messages).values([
      { ...row('thread-user', 'user', 1, 'main-answer'), threadId: 'active-spine-thread' },
      { ...row('thread-answer', 'assistant', 2, 'thread-user'), threadId: 'active-spine-thread' },
    ]);

    expect(await model.getActiveSpineMessageId({ topicId })).toBe('main-answer');
    expect(await model.getActiveSpineMessageId({
      threadId: 'active-spine-thread', topicId,
    })).toBe('thread-answer');
  });

  it('isolates user ownership and handles empty topics', async () => {
    expect(await model.getActiveSpineMessageId({ topicId })).toBeUndefined();
    await seedBranches();

    expect(await new MessageModel(db, otherUserId)
      .getActiveSpineMessageId({ topicId })).toBeUndefined();
    expect(await model.getActiveSpineMessageId({ topicId: 'missing-topic' })).toBeUndefined();
  });

  it('keeps the latest user input in complete reads beyond 1000 messages', async () => {
    const history = Array.from({ length: 1005 }, (_, index) => row(
      `long-${index}`,
      index % 2 === 0 ? 'user' : 'assistant',
      index,
      index === 0 ? undefined : `long-${index - 1}`,
    ));
    await db.insert(messages).values(history);

    const complete = await model.query({ topicId });
    expect(complete).toHaveLength(1005);
    expect(complete.at(-1)?.id).toBe('long-1004');
    expect(parse(complete).flatList.at(-1)?.id).toBe('long-1004');

    const explicitFirstPage = await model.query({ current: 0, pageSize: 1000, topicId });
    expect(explicitFirstPage).toHaveLength(1000);
    const explicitSecondPage = await model.query({ current: 1, pageSize: 1000, topicId });
    expect(explicitSecondPage.map((message) => message.id)).toEqual(
      ['long-1000', 'long-1001', 'long-1002', 'long-1003', 'long-1004'],
    );
  });
});
