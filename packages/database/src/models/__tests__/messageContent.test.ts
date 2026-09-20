// @vitest-environment node
import { parse } from '@lobechat/conversation-flow';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import {
  files,
  messageQueries,
  messages,
  messagesFiles,
  threads,
  topics,
  users,
  workspaces,
} from '../../schemas';
import { MessageModel } from '../message';
import { MessageContentModel } from '../messageContent';
import { TopicModel } from '../topic';

const db = await getTestDB();
const userId = 'context-editor-user';
const otherUserId = 'context-editor-other';
const topicId = 'context-editor-topic';
const model = new MessageContentModel(db, userId);
const reader = new MessageModel(db, userId);
const originalDate = new Date('2026-09-01T00:00:00Z');
const read = async () => reader.query({ topicId });
const insert = (anchorId = 'u1', position: 'before' | 'after' = 'after', id = 'context') =>
  model.insert({ anchorId, content: 'context text', fileIds: ['doc'], id, position });

beforeEach(async () => {
  await db.insert(users).values([{ id: userId }, { id: otherUserId }]);
  await db.insert(topics).values({ id: topicId, title: 'test', userId });
  await db.insert(files).values([
    { fileType: 'image/png', id: 'image', name: 'old.png', size: 10, url: '/old.png', userId },
    {
      fileType: 'text/plain',
      id: 'doc',
      name: 'context.txt',
      size: 10,
      url: '/context.txt',
      userId,
    },
    {
      fileType: 'image/png',
      id: 'foreign',
      name: 'private.png',
      size: 10,
      url: '/private.png',
      userId: otherUserId,
    },
  ]);
  await db.insert(messages).values([
    { content: 'first question', createdAt: originalDate, id: 'u1', role: 'user', topicId, userId },
    {
      content: 'original answer',
      createdAt: new Date(+originalDate + 1),
      id: 'a1',
      parentId: 'u1',
      role: 'assistant',
      topicId,
      userId,
    },
    {
      content: 'second question',
      createdAt: new Date(+originalDate + 2),
      id: 'u2',
      parentId: 'a1',
      role: 'user',
      topicId,
      userId,
    },
  ]);
  await db.insert(messagesFiles).values({ fileId: 'image', messageId: 'u1', userId });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, userId));
  await db.delete(users).where(eq(users.id, otherUserId));
  await db.delete(workspaces).where(eq(workspaces.id, 'context-workspace'));
});

describe('MessageContentModel', () => {
  it('atomically edits text and adds files, preserving images after a reload', async () => {
    await model.edit({ content: 'edited', fileIds: ['image', 'doc', 'doc'], id: 'u1' });
    const edited = (await read()).find((message) => message.id === 'u1')!;
    expect(edited.content).toBe('edited');
    expect(edited.imageList?.map((file) => file.id)).toEqual(['image']);
    expect(edited.fileList?.map((file) => file.id)).toEqual(['doc']);
    expect((await read()).find((message) => message.id === 'a1')?.content).toBe('original answer');
  });

  it('allows attachment-only messages and removes associations, not shared file objects', async () => {
    await model.edit({ content: '', fileIds: ['doc'], id: 'u1' });
    expect((await read())[0].imageList).toEqual([]);
    expect((await read())[0].fileList?.[0].id).toBe('doc');
    expect(await db.select().from(files).where(eq(files.id, 'image'))).toHaveLength(1);
  });

  it('rolls back text and file associations when any file is inaccessible', async () => {
    await expect(
      model.edit({ content: 'must not save', fileIds: ['doc', 'foreign'], id: 'u1' }),
    ).rejects.toThrow();
    const original = (await read())[0];
    expect(original.content).toBe('first question');
    expect(original.imageList?.[0].id).toBe('image');
    expect(original.fileList).toEqual([]);
  });

  it('rejects missing messages, another user, assistant edits and empty content', async () => {
    await expect(model.edit({ content: 'x', fileIds: [], id: 'missing' })).rejects.toThrow();
    await expect(
      new MessageContentModel(db, otherUserId).edit({ content: 'x', fileIds: [], id: 'u1' }),
    ).rejects.toThrow();
    await expect(model.edit({ content: 'x', fileIds: [], id: 'a1' })).rejects.toThrow();
    await expect(model.edit({ content: '  ', fileIds: [], id: 'u1' })).rejects.toThrow();
    expect((await read())[0].content).toBe('first question');
  });

  it.each(['before', 'after'] as const)(
    'inserts %s with attachments, correct raw/visible order and real timestamps',
    async (position) => {
      const started = Date.now();
      await insert('u1', position);
      const list = await read();
      const expected =
        position === 'before' ? ['context', 'u1', 'a1', 'u2'] : ['u1', 'context', 'a1', 'u2'];
      expect(list.map((message) => message.id)).toEqual(expected);
      expect(parse(list).flatList.map((message) => message.id)).toEqual(expected);
      expect(+new Date(list.find((message) => message.id === 'u1')!.createdAt)).toBe(+originalDate);
      expect(
        +new Date(list.find((message) => message.id === 'context')!.createdAt),
      ).toBeGreaterThanOrEqual(started);
      expect(list.find((message) => message.id === 'context')?.fileList?.[0].id).toBe('doc');
    },
  );

  it('inserts at the end and before the first message without changing existing answers', async () => {
    await insert('u2', 'after', 'last');
    await insert('u1', 'before', 'first');
    expect(parse(await read()).flatList.map((message) => message.id)).toEqual([
      'first',
      'u1',
      'a1',
      'u2',
      'last',
    ]);
  });

  it('handles repeated and nested insertions at one position', async () => {
    await insert('u1', 'after', 'context1');
    await insert('u1', 'after', 'context2');
    expect(parse(await read()).flatList.map((message) => message.id)).toEqual([
      'u1',
      'context2',
      'context1',
      'a1',
      'u2',
    ]);
  });

  it('is idempotent when the same insertion is retried', async () => {
    await insert();
    await insert();
    expect((await read()).filter((message) => message.id === 'context')).toHaveLength(1);
    expect(
      await db.select().from(messagesFiles).where(eq(messagesFiles.messageId, 'context')),
    ).toHaveLength(1);
  });

  it('keeps edits made after a lost insertion response without creating duplicate context', async () => {
    await insert();
    await model.insert({
      anchorId: 'u1',
      content: 'changed after retry',
      fileIds: ['image'],
      id: 'context',
      position: 'after',
    });
    const saved = (await read()).filter((message) => message.id === 'context');
    expect(saved).toHaveLength(1);
    expect(saved[0].content).toBe('changed after retry');
    expect(saved[0].imageList?.[0].id).toBe('image');
    expect(saved[0].fileList).toEqual([]);
    await expect(
      model.insert({
        anchorId: 'u1',
        content: 'wrong position',
        fileIds: [],
        id: 'context',
        position: 'before',
      }),
    ).rejects.toThrow('different position');
  });

  it('does not change the active alternative branch when inserting before that branch', async () => {
    await db.insert(messages).values({
      content: 'alternative',
      createdAt: new Date(+originalDate + 3),
      id: 'a2',
      parentId: 'u1',
      role: 'assistant',
      topicId,
      userId,
    });
    await db
      .update(messages)
      .set({ metadata: { activeBranchIndex: 1 } })
      .where(eq(messages.id, 'u1'));
    await insert('a2', 'before');
    expect(parse(await read()).flatList.map((message) => message.id)).toEqual([
      'u1',
      'context',
      'a2',
    ]);
    expect((await read()).find((message) => message.id === 'a1')?.parentId).toBe('u1');
  });

  it('preserves all alternative branches after insertion', async () => {
    await db.insert(messages).values({
      content: 'alternative',
      createdAt: new Date(+originalDate + 3),
      id: 'a2',
      parentId: 'u1',
      role: 'assistant',
      topicId,
      userId,
    });
    await db
      .update(messages)
      .set({ metadata: { activeBranchIndex: 1 } })
      .where(eq(messages.id, 'u1'));
    await insert('u1', 'after');
    expect(parse(await read()).flatList.map((message) => message.id)).toEqual([
      'u1',
      'context',
      'a2',
    ]);
    expect(
      (await read())
        .filter((message) => message.parentId === 'context')
        .map((message) => message.id),
    ).toEqual(['a1', 'a2']);
  });

  it('rejects cross-user insertion and rolls back when an attachment is not owned', async () => {
    await expect(
      new MessageContentModel(db, otherUserId).insert({
        anchorId: 'u1',
        content: 'x',
        fileIds: [],
        id: 'bad',
        position: 'after',
      }),
    ).rejects.toThrow();
    await expect(
      model.insert({
        anchorId: 'u1',
        content: 'x',
        fileIds: ['foreign'],
        id: 'bad',
        position: 'after',
      }),
    ).rejects.toThrow();
    expect((await read()).map((message) => message.id)).toEqual(['u1', 'a1', 'u2']);
  });

  it('isolates workspace files from personal requests', async () => {
    await db.insert(workspaces).values({
      id: 'context-workspace',
      name: 'team',
      primaryOwnerId: userId,
      slug: 'context-test',
    });
    await db.update(files).set({ workspaceId: 'context-workspace' }).where(eq(files.id, 'doc'));
    await expect(model.edit({ content: 'x', fileIds: ['doc'], id: 'u1' })).rejects.toThrow();
  });

  it('keeps thread messages isolated from main-history insertion', async () => {
    await db.insert(threads).values({
      id: 'context-thread',
      sourceMessageId: 'u1',
      topicId,
      type: 'continuation',
      userId,
    });
    await db.insert(messages).values({
      content: 'thread question',
      id: 'thread-user',
      parentId: 'u1',
      role: 'user',
      threadId: 'context-thread',
      topicId,
      userId,
    });
    await insert('u1', 'after');
    const [thread] = await db.select().from(messages).where(eq(messages.id, 'thread-user'));
    expect(thread.parentId).toBe('u1');
    await expect(
      model.insert({
        anchorId: 'u1',
        content: 'x',
        fileIds: [],
        id: 'wrong',
        position: 'after',
        threadId: 'context-thread',
      }),
    ).rejects.toThrow();
    await model.insert({
      anchorId: 'thread-user',
      content: 'thread context',
      fileIds: [],
      id: 'thread-context',
      position: 'after',
      threadId: 'context-thread',
    });
    expect((await read()).some((message) => message.id === 'thread-context')).toBe(false);
  });

  it('rejects splitting an assistant tool call from its results', async () => {
    await db
      .update(messages)
      .set({ tools: [{ id: 'call1' }] })
      .where(eq(messages.id, 'a1'));
    await expect(insert('a1', 'after')).rejects.toThrow('tool call');
    expect((await read()).some((message) => message.id === 'context')).toBe(false);
  });

  it('retains positioned context and file associations when a conversation is duplicated', async () => {
    await insert();
    const copied = await new TopicModel(db, userId).duplicate(topicId);
    const list = await reader.query({ topicId: copied.topic.id });
    const flat = parse(list).flatList;
    expect(flat.map((message) => message.content)).toEqual([
      'first question',
      'context text',
      'original answer',
      'second question',
    ]);
    const context = flat.find((message) => message.metadata?.isCustomContext)!;
    expect(context.id).not.toBe('context');
    expect(context.fileList?.[0].id).toBe('doc');
    expect(
      await db
        .select()
        .from(messagesFiles)
        .where(and(eq(messagesFiles.fileId, 'doc'), eq(messagesFiles.messageId, context.id))),
    ).toHaveLength(1);
  });

  it('includes inserted context in a continuation thread only when positioned before its source', async () => {
    await insert('u1', 'before', 'before');
    await insert('u1', 'after', 'after');
    await db.insert(threads).values({
      id: 'context-thread',
      sourceMessageId: 'u1',
      topicId,
      type: 'continuation',
      userId,
    });
    const list = await reader.query({ threadId: 'context-thread', topicId });
    expect(list.map((message) => message.id)).toEqual(['before', 'u1']);
  });

  it('invalidates retrieval queries derived from previous message content', async () => {
    await db.insert(messageQueries).values({ messageId: 'u1', userId, userQuery: 'old context' });
    await model.edit({ content: 'new', fileIds: [], id: 'u1' });
    expect(
      await db.select().from(messageQueries).where(eq(messageQueries.messageId, 'u1')),
    ).toEqual([]);
  });
});
