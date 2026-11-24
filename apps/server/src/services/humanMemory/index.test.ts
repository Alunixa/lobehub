// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { and, eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTestDB } from '@/database/core/getTestDB';
import {
  messages,
  topics,
  userCoreMemories,
  userEpisodicMemories,
  users,
} from '@/database/schemas';

import { HumanMemoryService } from './index';
import { memorySearchTokens } from './logic';

// External model runtimes are the boundary; all storage, retrieval and migration SQL stays real.
vi.mock('./provider', () => ({}));

const db = await getTestDB();
let userId: string;
let otherUserId: string;
let service: HumanMemoryService;
beforeEach(async () => {
  userId = `memory-test-${randomUUID()}`;
  otherUserId = `memory-other-${randomUUID()}`;
  await db.insert(users).values([{ id: userId }, { id: otherUserId }]);
  service = new HumanMemoryService(db, userId);
});
afterEach(async () => {
  await db.delete(users).where(eq(users.id, userId));
  await db.delete(users).where(eq(users.id, otherUserId));
  vi.restoreAllMocks();
});

describe('human memory storage and live retrieval contract', () => {
  it('applies the additive migration repeatedly and indexes existing Chinese and Latin facts', async () => {
    const [stored] = await db
      .insert(userEpisodicMemories)
      .values({
        content: '用户喜欢徒步和 TypeScript',
        userId,
      })
      .returning();
    const migration = await readFile(
      'packages/database/migrations/0118_human_memory_reliability.sql',
      'utf8',
    );
    for (let index = 0; index < 2; index++) {
      for (const statement of migration
        .split('--> statement-breakpoint')
        .filter((text) => text.trim()))
        await db.execute(sql.raw(statement));
    }
    const [memory] = await db
      .select()
      .from(userEpisodicMemories)
      .where(eq(userEpisodicMemories.id, stored.id));
    expect(memory.searchTokens).toEqual(expect.arrayContaining(['徒步', 'typescript']));
    expect(memory.content).toBe(stored.content);
  });
  it('initializes Core Memory when a recall status row appears during extraction', async () => {
    await service.persistAfterCompletion(
      { assistantReply: 'Noted', userMessage: 'Remember that my name is Alex' },
      {
        extractCoreMemory: async () => {
          await db.insert(userCoreMemories).values({ userId, lastRecallCount: 0 });
          return {
            operations: [{ action: 'ADD', content: 'Name: Alex', slot: 'userCore' }],
          };
        },
      },
    );
    expect((await service.getCoreMemory())?.userCore).toBe('Name: Alex');
  });

  it('gradually embeds older lexical facts without modifying a different user', async () => {
    await db.insert(userEpisodicMemories).values([
      { content: 'Earlier mountain trip', searchTokens: ['mountain'], userId },
      { content: 'Private mountain trip', searchTokens: ['mountain'], userId: otherUserId },
    ]);
    await service.persistAfterCompletion(
      { assistantReply: 'hello', userMessage: 'hi' },
      { embed: async () => [1, 0], embeddingModel: 'embed-a' },
    );
    const [own] = await service.getEpisodicMemories();
    expect(own.embedding).toEqual([1, 0]);
    expect(own.embeddingModel).toBe('embed-a');
    const [foreign] = await new HumanMemoryService(db, otherUserId).getEpisodicMemories();
    expect(foreign.embedding).toBeNull();
  });
  it('updates a database-created Core snapshot with sub-millisecond timestamp precision', async () => {
    await db.insert(userCoreMemories).values({ userId, personaTone: 'Original style' });
    await service.persistAfterCompletion(
      { assistantReply: 'Noted', userMessage: 'Please call me Alex' },
      {
        extractCoreMemory: async () => ({
          operations: [{ action: 'ADD', content: 'Call the user Alex', slot: 'personaTone' }],
        }),
      },
    );
    const core = await service.getCoreMemory();
    expect(core?.personaTone).toContain('Original style');
    expect(core?.personaTone).toContain('Call the user Alex');
    expect(core?.lastExtractionError).toBeNull();
  });

  it('does not reinforce a candidate that finished after the recall deadline', async () => {
    const recall = vi.spyOn(
      service as unknown as { recall: () => Promise<{ memories: unknown[]; mode: string }> },
      'recall',
    );
    let finish!: (value: { memories: unknown[]; mode: string }) => void;
    recall.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const reinforce = vi.spyOn(
      service as unknown as { reinforceRecalledMemories: (ids: string[]) => Promise<void> },
      'reinforceRecalledMemories',
    );
    const result = await service.prepareContext({
      messages: [],
      timeoutMs: 5,
      userMessage: 'Some earlier fact',
    });
    expect(result.recalledMemories).toEqual([]);
    finish({ memories: [{ content: 'Late fact', id: 'late' }], mode: 'semantic' });
    await Promise.resolve();
    expect(reinforce).not.toHaveBeenCalled();
  });

  it('recalls relevant older facts beyond 200 newer irrelevant records and isolates users', async () => {
    await db.insert(userEpisodicMemories).values([
      {
        content: 'hiking',
        id: 'old-' + userId,
        importance: 0.8,
        searchTokens: ['hiking'],
        userId,
        lastRecalledAt: new Date('2020-01-01'),
      },
      ...Array.from({ length: 210 }, (_, index) => ({
        content: `coffee ${index}`,
        searchTokens: ['coffee', String(index)],
        userId,
      })),
      { content: 'hiking private fact', searchTokens: ['hiking'], userId: otherUserId },
    ]);
    const prepared = await service.prepareContext({
      messages: [],
      queryEmbedding: [1, 0],
      queryEmbeddingModel: 'test-embedding',
      timeoutMs: 3000,
      userMessage: 'hiking',
    });
    expect(prepared.recalledMemories.map((memory) => memory.id)).toEqual(['old-' + userId]);
    expect(prepared.memoryPrompt).not.toContain('private fact');
  });

  it('uses matching-model vectors to wake old facts with different wording', async () => {
    await db.insert(userEpisodicMemories).values([
      {
        content: 'A past mountain expedition',
        embedding: [1, 0],
        embeddingModel: 'embed-a',
        importance: 0.5,
        lastRecalledAt: new Date('2000-01-01'),
        searchTokens: ['mountain'],
        userId,
      },
      {
        content: 'Wrong-model vector',
        embedding: [1, 0],
        embeddingModel: 'embed-b',
        importance: 1,
        searchTokens: ['unrelated'],
        userId,
      },
    ]);
    const prepared = await service.prepareContext({
      messages: [],
      queryEmbedding: [1, 0],
      queryEmbeddingModel: 'embed-a',
      timeoutMs: 3000,
      userMessage: 'that earlier outdoor trip',
    });
    expect(prepared.recalledMemories.map((memory) => memory.content)).toEqual([
      'A past mountain expedition',
    ]);
  });

  it('keeps stored Core Memory when the cold recall budget expires', async () => {
    await service.updateCoreMemory({
      activeMatters: null,
      personaTone: 'Concise',
      userCore: 'Lives in Hangzhou',
    });
    const prepared = await service.prepareContext({
      messages: [{ content: 'hi', role: 'user' }],
      queryEmbedding: [1, 0],
      timeoutMs: 1,
      userMessage: 'hi',
    });
    expect(prepared.memoryPrompt).toContain('Lives in Hangzhou');
    expect(prepared.recentMessages).toEqual([{ content: 'hi', role: 'user' }]);
  });

  it('updates a corrected fact in place and deletes only a candidate owned by this user', async () => {
    const [existing] = await db
      .insert(userEpisodicMemories)
      .values({
        content: 'User lives in Hangzhou',
        searchTokens: memorySearchTokens('User lives in Hangzhou'),
        userId,
      })
      .returning();
    const [foreign] = await db
      .insert(userEpisodicMemories)
      .values({
        content: 'User lives in Hangzhou',
        searchTokens: memorySearchTokens('User lives in Hangzhou'),
        userId: otherUserId,
      })
      .returning();
    await service.persistAfterCompletion(
      {
        assistantReply: 'Updated',
        userMessage: 'I no longer live in Hangzhou; I live in Singapore',
      },
      {
        extractEpisodicMemories: async () => [
          {
            action: 'UPDATE',
            content: 'User lives in Singapore',
            id: existing.id,
            importance: 0.8,
          },
          { action: 'DELETE', content: '', id: foreign.id },
        ],
      },
    );
    const own = await db
      .select()
      .from(userEpisodicMemories)
      .where(eq(userEpisodicMemories.userId, userId));
    expect(own).toHaveLength(1);
    expect(own[0].content).toBe('User lives in Singapore');
    expect(await new HumanMemoryService(db, otherUserId).getEpisodicMemoryCount()).toBe(1);
  });

  it('preserves a concurrent manual Core edit instead of applying a stale model snapshot', async () => {
    await service.updateCoreMemory({ activeMatters: null, personaTone: 'Old', userCore: null });
    await service.persistAfterCompletion(
      { assistantReply: 'ok', userMessage: 'New style' },
      {
        extractCoreMemory: async () => {
          await service.updateCoreMemory({
            activeMatters: null,
            personaTone: 'Manual edit',
            userCore: null,
          });
          return {
            operations: [{ action: 'REPLACE', content: 'Stale model edit', slot: 'personaTone' }],
          };
        },
      },
    );
    expect((await service.getCoreMemory())?.personaTone).toBe('Manual edit');
  });

  it('does not mark a failed backfill complete and allows a later retry', async () => {
    const [topic] = await db.insert(topics).values({ userId }).returning();
    await db.insert(messages).values([
      {
        content: 'Remember my project',
        role: 'user',
        topicId: topic.id,
        userId,
        createdAt: new Date(1000),
      },
      { content: 'Noted', role: 'assistant', topicId: topic.id, userId, createdAt: new Date(2000) },
      { content: 'next', role: 'user', topicId: topic.id, userId, createdAt: new Date(3000) },
    ]);
    const extraction = vi.fn().mockRejectedValue(new Error('fixture failure'));
    service.scheduleLazyBackfill({
      messages: [],
      sourceTopicId: topic.id,
      windowSize: 1,
      provider: { extractCoreMemory: extraction },
    });
    await vi.waitFor(async () => {
      expect(extraction).toHaveBeenCalledOnce();
      const [row] = await db
        .select()
        .from(userCoreMemories)
        .where(eq(userCoreMemories.userId, userId));
      expect(row?.lastExtractionError).toBe('ExtractionFailed');
      const [stored] = await db
        .select()
        .from(topics)
        .where(and(eq(topics.id, topic.id), eq(topics.userId, userId)));
      expect(stored.memoryMigrated).toBe(false);
      expect(stored.memoryBackfillState?.lease).toBeUndefined();
    });
    service.scheduleLazyBackfill({
      messages: [],
      sourceTopicId: topic.id,
      windowSize: 1,
      provider: { extractCoreMemory: async () => ({ operations: [] }) },
    });
    await vi.waitFor(async () => {
      const [stored] = await db.select().from(topics).where(eq(topics.id, topic.id));
      expect(stored.memoryMigrated).toBe(true);
      expect(stored.memoryBackfillState?.version).toBe(2);
    });
  });
});
