import { randomUUID } from 'node:crypto';

import debug from 'debug';
import { and, asc, count, desc, eq, inArray, or, sql } from 'drizzle-orm';

import {
  messages as messagesTable,
  topics,
  userCoreMemories,
  type UserCoreMemoryItem,
  userEpisodicMemories,
  type UserEpisodicMemoryItem,
} from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import {
  applyCoreMemoryOperations,
  buildHumanMemoryPrompt,
  buildRecentMemoryWindow,
  type CoreMemoryOperations,
  DEFAULT_DEDUPLICATION_THRESHOLD,
  DEFAULT_HUMAN_MEMORY_WINDOW_SIZE,
  formatMemoryTranscript,
  type HumanMemoryMessage,
  type HumanMemorySlot,
  memorySearchTokens,
  rankEpisodicMemories,
  textSimilarity,
} from './logic';

const log = debug('lobe-server:human-memory');

const backfillsInFlight = new Set<string>();
const coreCache = new Map<string, { expires: number; value: UserCoreMemoryItem | null }>();
const vectorCache = new Map<string, { embedding?: number[]; model?: string; expires: number }>();
const userQueues = new Map<string, Promise<void>>();

export type HumanMemorySettings = {
  enabled?: boolean;
  embeddingModel?: string;
  model?: string;
  windowSize?: number;
};

export type HumanMemoryExtractionInput = {
  assistantReply: string;
  backfill?: boolean;
  sourceTopicId?: string;
  userMessage: string;
};

export type EpisodicMemoryExtraction = {
  action?: 'ADD' | 'UPDATE' | 'DELETE' | 'NONE';
  content: string;
  embedding?: number[] | null;
  importance?: number;
  id?: string | null;
};

export type HumanMemoryExtractionProvider = {
  embeddingModel?: string;
  embed?: (text: string) => Promise<number[] | undefined>;
  extractCoreMemory?: (input: {
    conversation: HumanMemoryExtractionInput;
    current: Pick<UserCoreMemoryItem, HumanMemorySlot>;
  }) => Promise<CoreMemoryOperations>;
  extractEpisodicMemories?: (input: {
    conversation: HumanMemoryExtractionInput;
    existing?: { content: string; id: string }[];
  }) => Promise<EpisodicMemoryExtraction[]>;
};

export type PrepareHumanMemoryContextInput = {
  messages: readonly HumanMemoryMessage[];
  queryEmbedding?: number[] | null;
  queryEmbeddingModel?: string;
  embeddingModel?: string;
  timeoutMs?: number;
  userMessage: string;
  windowSize?: number;
  sourceTopicId?: string;
};

export type PreparedHumanMemoryContext = {
  coreMemory: UserCoreMemoryItem | null;
  memoryPrompt: string;
  recalledMemories: ReturnType<typeof rankEpisodicMemories>;
  recentMessages: HumanMemoryMessage[];
};

export type LazyBackfillInput = {
  messages: readonly HumanMemoryMessage[];
  provider?: HumanMemoryExtractionProvider;
  sourceTopicId: string;
  windowSize?: number;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), Math.max(1, timeoutMs));
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export class HumanMemoryService {
  constructor(
    private readonly db: LobeChatDatabase,
    private readonly userId: string,
  ) {}

  async getCoreMemory(): Promise<UserCoreMemoryItem | null> {
    const [row] = await this.db
      .select()
      .from(userCoreMemories)
      .where(eq(userCoreMemories.userId, this.userId))
      .limit(1);
    if (coreCache.size > 500) coreCache.delete(coreCache.keys().next().value!);
    coreCache.set(this.userId, { expires: Date.now() + 30_000, value: row ?? null });
    return row ?? null;
  }

  async updateCoreMemory(
    slots: Pick<UserCoreMemoryItem, HumanMemorySlot>,
  ): Promise<UserCoreMemoryItem> {
    slots = applyCoreMemoryOperations(slots, []);
    const [row] = await this.db
      .insert(userCoreMemories)
      .values({
        ...slots,
        userId: this.userId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userCoreMemories.userId,
        set: {
          ...slots,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!row) throw new Error('Failed to persist core memory');
    coreCache.delete(this.userId);
    return row;
  }

  async getEpisodicMemories(limit = 200): Promise<UserEpisodicMemoryItem[]> {
    return this.db
      .select()
      .from(userEpisodicMemories)
      .where(eq(userEpisodicMemories.userId, this.userId))
      .orderBy(desc(userEpisodicMemories.lastRecalledAt))
      .limit(Math.max(1, Math.min(limit, 1000)));
  }

  async getEpisodicMemoryCount(): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(userEpisodicMemories)
      .where(eq(userEpisodicMemories.userId, this.userId));
    return row?.count ?? 0;
  }

  async clearEpisodicMemories(): Promise<void> {
    await this.db.delete(userEpisodicMemories).where(eq(userEpisodicMemories.userId, this.userId));
    await this.db
      .update(topics)
      .set({ memoryMigrated: true, memoryBackfillState: { version: 2 } })
      .where(eq(topics.userId, this.userId));
  }

  async prepareContext(input: PrepareHumanMemoryContextInput): Promise<PreparedHumanMemoryContext> {
    const recentMessages = buildRecentMemoryWindow(
      input.messages,
      input.windowSize ?? DEFAULT_HUMAN_MEMORY_WINDOW_SIZE,
    );
    const cached = coreCache.get(this.userId);
    const coreMemory =
      cached && cached.expires > Date.now()
        ? cached.value
        : await withTimeout(
            this.getCoreMemory().catch((error) => {
              log('Core memory read failed: %O', error);
              return cached?.value ?? null;
            }),
            250,
            cached?.value ?? null,
          );
    const recalled = await withTimeout(
      this.recall(input).catch((error) => {
        log('Memory recall failed: %O', error);
        return { memories: [], mode: 'keyword' as const };
      }),
      input.timeoutMs ?? 250,
      { memories: [], mode: 'keyword' as const },
    );
    const recalledMemories = recalled.memories;
    if (recalledMemories.length)
      void this.reinforceRecalledMemories(recalledMemories.map((memory) => memory.id)).catch(
        (error) => log('Memory reinforcement failed: %O', error),
      );
    void this.updateStatus({
      lastRecallAt: new Date(),
      lastRecallCount: recalledMemories.length,
      retrievalMode: recalled.mode,
    }).catch((error) => log('Memory status update failed: %O', error));
    return {
      coreMemory,
      memoryPrompt: buildHumanMemoryPrompt({ coreMemory, recalledMemories }),
      recalledMemories,
      recentMessages,
    };
  }

  private async recall(input: PrepareHumanMemoryContextInput) {
    let queryEmbedding = input.queryEmbedding ?? undefined;
    let embeddingModel = input.queryEmbeddingModel;
    const key = `${this.userId}:${input.embeddingModel ?? ''}:${input.userMessage.slice(-4000)}`;
    const cached = vectorCache.get(key);
    if (!queryEmbedding && cached && cached.expires > Date.now()) {
      queryEmbedding = cached.embedding;
      embeddingModel = cached.model;
    } else if (!queryEmbedding) {
      // Continue lexical recall immediately; a slow first vector request warms the next lookup.
      const task = (async () => {
        const { resolveHumanMemoryEmbeddingRuntime } = await import('./embeddingRuntime');
        const runtime = await resolveHumanMemoryEmbeddingRuntime(
          this.db,
          this.userId,
          input.embeddingModel,
        );
        const vector = runtime
          ? (
              await runtime.runtime.embeddings(
                {
                  input: [input.userMessage.slice(-4000)],
                  model: runtime.model,
                },
                { signal: AbortSignal.timeout(5000), user: this.userId },
              )
            )?.[0]
          : undefined;
        if (vectorCache.size > 300) vectorCache.delete(vectorCache.keys().next().value!);
        const value = { embedding: vector, model: runtime?.model, expires: Date.now() + 120_000 };
        vectorCache.set(key, value);
        return value;
      })().catch((error) => {
        log('Query embedding unavailable: %O', error);
        const value = { embedding: undefined, model: undefined, expires: Date.now() + 60_000 };
        vectorCache.set(key, value);
        return value;
      });
      const value = await withTimeout(task, 175, undefined);
      queryEmbedding = value?.embedding;
      embeddingModel = value?.model;
    }
    const memories = (
      await this.searchCandidates(input.userMessage, queryEmbedding, embeddingModel)
    ).map((memory) => ({
      ...memory,
      embedding: memory.embeddingModel === embeddingModel ? memory.embedding : null,
    }));
    return {
      memories: rankEpisodicMemories({
        memories,
        query: input.userMessage,
        queryEmbedding,
      }),
      mode: queryEmbedding ? ('semantic' as const) : ('keyword' as const),
    };
  }

  private async searchCandidates(query: string, embedding?: number[], embeddingModel?: string) {
    const tokens = memorySearchTokens(query).slice(0, 128);
    if (!tokens.length) return [];
    const tokenArray = sql`ARRAY[${sql.join(
      tokens.map((token) => sql`${token}`),
      sql`, `,
    )}]::text[]`;
    const overlap = sql`(${userEpisodicMemories.searchTokens} && ${tokenArray})`;
    const lexical = sql<number>`(
      SELECT count(*)::float / ${tokens.length}
      FROM unnest(${userEpisodicMemories.searchTokens}) token WHERE token = ANY(${tokenArray})
    )`;
    const vectorMatch =
      embedding?.length && embeddingModel
        ? sql<number>`CASE WHEN ${userEpisodicMemories.embeddingModel} = ${embeddingModel}
          AND jsonb_array_length(${userEpisodicMemories.embedding}) = ${embedding.length}
          THEN (SELECT coalesce(sum(v::float * (${JSON.stringify(embedding)}::jsonb ->> (i-1)::int)::float)
            / nullif(sqrt(sum(power(v::float,2)) * sum(power((${JSON.stringify(embedding)}::jsonb ->> (i-1)::int)::float,2))),0),0)
            FROM jsonb_array_elements_text(${userEpisodicMemories.embedding}) WITH ORDINALITY AS e(v,i))
          ELSE 0 END`
        : sql<number>`0`;
    const relevance = sql<number>`greatest(${lexical}, ${vectorMatch})`;
    return this.db
      .select()
      .from(userEpisodicMemories)
      .where(
        and(
          eq(userEpisodicMemories.userId, this.userId),
          embedding ? or(overlap, sql`${vectorMatch} >= 0.15`) : overlap,
        ),
      )
      .orderBy(desc(relevance), desc(userEpisodicMemories.lastRecalledAt))
      .limit(15);
  }

  private async updateStatus(
    status: Partial<
      Pick<
        UserCoreMemoryItem,
        | 'lastExtractionAt'
        | 'lastExtractionError'
        | 'lastRecallAt'
        | 'lastRecallCount'
        | 'retrievalMode'
      >
    >,
  ) {
    await this.db
      .insert(userCoreMemories)
      .values({ userId: this.userId, ...status })
      .onConflictDoUpdate({ target: userCoreMemories.userId, set: status });
    if (status.lastExtractionAt || status.lastExtractionError) coreCache.delete(this.userId);
  }

  /**
   * Schedule post-response memory work without delaying the streaming response.
   */
  schedulePostReply(
    input: HumanMemoryExtractionInput,
    provider?: HumanMemoryExtractionProvider,
  ): void {
    if (!provider) return;
    const previous = userQueues.get(this.userId) ?? Promise.resolve();
    const task = previous
      .catch((error) => log('Previous memory job failed: %O', error))
      .then(() => this.persistAfterCompletion(input, provider))
      .catch(async (error) => {
        await this.updateStatus({
          lastExtractionError: error instanceof Error ? error.name : 'ExtractionError',
        });
        log('Post-reply memory persistence failed: %O', error);
      });
    userQueues.set(this.userId, task);
    void task
      .finally(() => {
        if (userQueues.get(this.userId) === task) userQueues.delete(this.userId);
      })
      .catch((error) => log('Memory job cleanup failed: %O', error));
  }

  async persistAfterCompletion(
    input: HumanMemoryExtractionInput,
    provider: HumanMemoryExtractionProvider,
  ): Promise<void> {
    const pureConversation = {
      assistantReply: input.assistantReply,
      backfill: input.backfill,
      sourceTopicId: input.sourceTopicId,
      userMessage: input.userMessage,
    };

    let failed = false;
    if (provider.extractCoreMemory) {
      try {
        const current = (await this.getCoreMemory()) ?? {
          activeMatters: null,
          personaTone: null,
          userCore: null,
        };
        const operations = await provider.extractCoreMemory({
          conversation: pureConversation,
          current,
        });
        const slots = applyCoreMemoryOperations(
          current,
          input.backfill
            ? operations.operations.filter((operation) => !current[operation.slot])
            : operations.operations,
        );
        // A concurrent manual edit must win over a model's stale snapshot.
        if ('updatedAt' in current) {
          await this.db
            .update(userCoreMemories)
            .set({ ...slots, updatedAt: new Date() })
            .where(
              and(
                eq(userCoreMemories.userId, this.userId),
                // PostgreSQL timestamps can contain microseconds that JavaScript Date loses.
                // Compare the snapshot's slots, so status writes do not invalidate the update.
                sql`${userCoreMemories.personaTone} IS NOT DISTINCT FROM ${current.personaTone}`,
                sql`${userCoreMemories.userCore} IS NOT DISTINCT FROM ${current.userCore}`,
                sql`${userCoreMemories.activeMatters} IS NOT DISTINCT FROM ${current.activeMatters}`,
              ),
            );
          coreCache.delete(this.userId);
        } else {
          await this.db
            .insert(userCoreMemories)
            .values({ ...slots, userId: this.userId })
            .onConflictDoUpdate({
              target: userCoreMemories.userId,
              set: { ...slots, updatedAt: new Date() },
              setWhere: and(
                sql`${userCoreMemories.personaTone} IS NULL`,
                sql`${userCoreMemories.userCore} IS NULL`,
                sql`${userCoreMemories.activeMatters} IS NULL`,
              ),
            });
        }
      } catch (error) {
        failed = true;
        log('Core memory update failed: %O', error);
      }
    }

    if (provider.extractEpisodicMemories) {
      try {
        const existing = await this.searchCandidates(input.userMessage);
        const extracted = await provider.extractEpisodicMemories({
          conversation: pureConversation,
          existing: existing.map(({ content, id }) => ({ content, id })),
        });
        for (const candidate of extracted) {
          if (candidate.action === 'NONE') continue;
          if (input.backfill && (candidate.action === 'UPDATE' || candidate.action === 'DELETE'))
            continue;
          if (candidate.action === 'DELETE') {
            if (candidate.id && existing.some((memory) => memory.id === candidate.id)) {
              await this.db
                .delete(userEpisodicMemories)
                .where(
                  and(
                    eq(userEpisodicMemories.userId, this.userId),
                    eq(userEpisodicMemories.id, candidate.id),
                  ),
                );
            }
            continue;
          }
          const content = candidate.content.trim();
          if (!content) continue;
          const embedding = candidate.embedding ?? (await provider.embed?.(content));
          await this.upsertEpisodicMemory({
            content,
            embedding,
            importance: candidate.importance,
            sourceTopicId: input.sourceTopicId,
            embeddingModel: provider.embeddingModel,
            id:
              candidate.action === 'UPDATE' && existing.some((memory) => memory.id === candidate.id)
                ? (candidate.id ?? undefined)
                : undefined,
          });
        }
      } catch (error) {
        failed = true;
        log('Episodic memory update failed: %O', error);
      }
    }
    if (!failed && provider.embed && provider.embeddingModel) {
      // Older lexical-only facts become semantically searchable gradually, without blocking chat.
      const pending = await this.db
        .select({ content: userEpisodicMemories.content, id: userEpisodicMemories.id })
        .from(userEpisodicMemories)
        .where(
          and(
            eq(userEpisodicMemories.userId, this.userId),
            sql`${userEpisodicMemories.embeddingModel} IS DISTINCT FROM ${provider.embeddingModel}`,
          ),
        )
        .orderBy(asc(userEpisodicMemories.createdAt))
        .limit(4);
      for (const memory of pending) {
        const embedding = await provider.embed(memory.content);
        if (!embedding?.length || !embedding.every(Number.isFinite)) continue;
        await this.db
          .update(userEpisodicMemories)
          .set({ embedding, embeddingModel: provider.embeddingModel })
          .where(
            and(
              eq(userEpisodicMemories.id, memory.id),
              eq(userEpisodicMemories.userId, this.userId),
              eq(userEpisodicMemories.content, memory.content),
            ),
          );
      }
    }
    await this.updateStatus({
      lastExtractionAt: new Date(),
      lastExtractionError: failed ? 'ExtractionFailed' : null,
    });
    if (failed) throw new Error('Human memory extraction failed; backfill remains retryable.');
  }

  scheduleLazyBackfill(input: LazyBackfillInput): void {
    const key = `${this.userId}:${input.sourceTopicId}`;
    if (backfillsInFlight.has(key) || !input.provider) return;

    backfillsInFlight.add(key);
    void this.runLazyBackfill(input)
      .catch((error) => log('Lazy memory backfill failed for %s: %O', key, error))
      .finally(() => backfillsInFlight.delete(key));
  }

  private async runLazyBackfill(input: LazyBackfillInput): Promise<void> {
    const lease = randomUUID();
    const now = Date.now();
    const [topic] = await this.db
      .update(topics)
      .set({
        memoryBackfillState: sql`coalesce(${topics.memoryBackfillState}, '{}'::jsonb) ||
        ${JSON.stringify({ lease, leaseUntil: now + 300_000 })}::jsonb`,
      })
      .where(
        and(
          eq(topics.id, input.sourceTopicId),
          eq(topics.userId, this.userId),
          or(
            eq(topics.memoryMigrated, false),
            sql`coalesce((${topics.memoryBackfillState}->>'version')::int, 0) < 2`,
          ),
          sql`coalesce((${topics.memoryBackfillState}->>'leaseUntil')::bigint, 0) < ${now}`,
        ),
      )
      .returning({ state: topics.memoryBackfillState });
    if (!topic) return;
    const sourceMessages = await this.db
      .select({
        content: messagesTable.content,
        id: messagesTable.id,
        role: messagesTable.role,
      })
      .from(messagesTable)
      .where(
        and(eq(messagesTable.userId, this.userId), eq(messagesTable.topicId, input.sourceTopicId)),
      )
      .orderBy(asc(messagesTable.createdAt), asc(messagesTable.id));
    const allMessages = sourceMessages.length ? sourceMessages : input.messages;
    const recentMessages = buildRecentMemoryWindow(allMessages, input.windowSize);
    const historicalMessages = allMessages
      .slice(0, allMessages.length - recentMessages.length)
      .filter((message) => message.role === 'user' || message.role === 'assistant');
    const resumeIndex = topic.state?.cursor
      ? historicalMessages.findIndex((message) => message.id === topic.state?.cursor) + 1
      : 0;
    try {
      for (let start = resumeIndex; start < historicalMessages.length;) {
        let end = start + 1;
        let rounds = historicalMessages[start]?.role === 'user' ? 1 : 0;
        for (; end < historicalMessages.length; end++) {
          if (historicalMessages[end]?.role === 'user' && ++rounds > 10) break;
          if (formatMemoryTranscript(historicalMessages.slice(start, end + 1)).length > 12_000)
            break;
        }
        const chunk = historicalMessages.slice(start, end);
        start = end;
        const transcript = formatMemoryTranscript(chunk);
        if (!transcript) continue;

        await this.persistAfterCompletion(
          {
            assistantReply: '',
            backfill: true,
            sourceTopicId: input.sourceTopicId,
            userMessage: transcript,
          },
          input.provider!,
        );
        await this.db
          .update(topics)
          .set({
            memoryBackfillState: {
              cursor: chunk.at(-1)?.id,
              lease,
              leaseUntil: Date.now() + 300_000,
            },
          })
          .where(
            and(
              eq(topics.id, input.sourceTopicId),
              eq(topics.userId, this.userId),
              sql`${topics.memoryBackfillState}->>'lease' = ${lease}`,
            ),
          );
      }

      await this.db
        .update(topics)
        .set({ memoryMigrated: true, memoryBackfillState: { version: 2 } })
        .where(
          and(
            eq(topics.id, input.sourceTopicId),
            eq(topics.userId, this.userId),
            sql`${topics.memoryBackfillState}->>'lease' = ${lease}`,
          ),
        );
    } finally {
      await this.db
        .update(topics)
        .set({
          memoryBackfillState: sql`${topics.memoryBackfillState} - 'lease' - 'leaseUntil'`,
        })
        .where(
          and(
            eq(topics.id, input.sourceTopicId),
            eq(topics.userId, this.userId),
            sql`${topics.memoryBackfillState}->>'lease' = ${lease}`,
          ),
        );
    }
  }

  private async reinforceRecalledMemories(ids: string[]): Promise<void> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return;
    const now = new Date();
    const memories = await this.db
      .select({ id: userEpisodicMemories.id, strengthS: userEpisodicMemories.strengthS })
      .from(userEpisodicMemories)
      .where(
        and(
          eq(userEpisodicMemories.userId, this.userId),
          inArray(userEpisodicMemories.id, uniqueIds),
        ),
      );

    await Promise.all(
      memories.map((memory) =>
        this.db
          .update(userEpisodicMemories)
          .set({
            lastRecalledAt: now,
            strengthS: Math.min((memory.strengthS ?? 7) * 2, 180),
          })
          .where(
            and(
              eq(userEpisodicMemories.userId, this.userId),
              eq(userEpisodicMemories.id, memory.id),
            ),
          ),
      ),
    );
  }

  private async upsertEpisodicMemory({
    content,
    embedding,
    importance,
    sourceTopicId,
    embeddingModel,
    id,
  }: {
    content: string;
    embedding?: number[];
    importance?: number;
    sourceTopicId?: string;
    embeddingModel?: string;
    id?: string;
  }): Promise<void> {
    const existing = await this.searchCandidates(content, embedding, embeddingModel);
    if (id && !existing.some((memory) => memory.id === id)) {
      const [target] = await this.db
        .select()
        .from(userEpisodicMemories)
        .where(and(eq(userEpisodicMemories.userId, this.userId), eq(userEpisodicMemories.id, id)))
        .limit(1);
      if (target) existing.push(target);
    }
    const duplicate =
      existing.find((memory) => memory.id === id) ??
      existing.find((memory) => {
        const vectorMatch =
          embedding && memory.embedding && memory.embeddingModel === embeddingModel
            ? rankEpisodicMemories({
                limit: 1,
                memories: [
                  {
                    content: memory.content,
                    embedding: memory.embedding,
                    id: memory.id,
                    importance: memory.importance,
                    lastRecalledAt: memory.lastRecalledAt,
                    strengthS: memory.strengthS,
                  },
                ],
                query: content,
                queryEmbedding: embedding,
              })[0]?.semanticSim
            : undefined;
        return (
          (vectorMatch ?? textSimilarity(content, memory.content)) >=
          DEFAULT_DEDUPLICATION_THRESHOLD
        );
      });

    if (duplicate) {
      await this.db
        .update(userEpisodicMemories)
        .set({
          content: id || content.length > duplicate.content.length ? content : duplicate.content,
          embedding: embedding ?? (id ? null : duplicate.embedding),
          embeddingModel: embedding ? embeddingModel : id ? null : duplicate.embeddingModel,
          searchTokens: memorySearchTokens(
            id || content.length > duplicate.content.length ? content : duplicate.content,
          ),
          importance: Math.max(duplicate.importance, importance ?? 0.5),
        })
        .where(
          and(
            eq(userEpisodicMemories.userId, this.userId),
            eq(userEpisodicMemories.id, duplicate.id),
          ),
        );
      return;
    }

    await this.db.insert(userEpisodicMemories).values({
      content,
      embedding,
      embeddingModel,
      searchTokens: memorySearchTokens(content),
      importance: Math.max(0.1, Math.min(1, importance ?? 0.5)),
      sourceTopicId,
      userId: this.userId,
    });
  }
}

export * from './logic';
export * from './provider';
