import debug from 'debug';
import { and, desc, eq, inArray } from 'drizzle-orm';

import {
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
  type EpisodicMemoryCandidate,
  formatMemoryTranscript,
  type HumanMemoryMessage,
  type HumanMemorySlot,
  rankEpisodicMemories,
  textSimilarity,
} from './logic';

const log = debug('lobe-server:human-memory');

const backfillsInFlight = new Set<string>();

export type HumanMemorySettings = {
  enabled?: boolean;
  embeddingModel?: string;
  model?: string;
  windowSize?: number;
};

export type HumanMemoryExtractionInput = {
  assistantReply: string;
  sourceTopicId?: string;
  userMessage: string;
};

export type EpisodicMemoryExtraction = {
  content: string;
  embedding?: number[] | null;
  importance?: number;
};

export type HumanMemoryExtractionProvider = {
  embed?: (text: string) => Promise<number[] | undefined>;
  extractCoreMemory?: (input: {
    conversation: HumanMemoryExtractionInput;
    current: Pick<UserCoreMemoryItem, HumanMemorySlot>;
  }) => Promise<CoreMemoryOperations>;
  extractEpisodicMemories?: (input: {
    conversation: HumanMemoryExtractionInput;
  }) => Promise<EpisodicMemoryExtraction[]>;
};

export type PrepareHumanMemoryContextInput = {
  messages: readonly HumanMemoryMessage[];
  queryEmbedding?: number[] | null;
  timeoutMs?: number;
  userMessage: string;
  windowSize?: number;
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
    return row ?? null;
  }

  async updateCoreMemory(
    slots: Pick<UserCoreMemoryItem, HumanMemorySlot>,
  ): Promise<UserCoreMemoryItem> {
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
    const rows = await this.db
      .select({ id: userEpisodicMemories.id })
      .from(userEpisodicMemories)
      .where(eq(userEpisodicMemories.userId, this.userId));
    return rows.length;
  }

  async clearEpisodicMemories(): Promise<void> {
    await this.db.delete(userEpisodicMemories).where(eq(userEpisodicMemories.userId, this.userId));
  }

  async prepareContext(
    input: PrepareHumanMemoryContextInput,
  ): Promise<PreparedHumanMemoryContext> {
    const recentMessages = buildRecentMemoryWindow(
      input.messages,
      input.windowSize ?? DEFAULT_HUMAN_MEMORY_WINDOW_SIZE,
    );
    const fallback: PreparedHumanMemoryContext = {
      coreMemory: null,
      memoryPrompt: '',
      recalledMemories: [],
      recentMessages,
    };

    return withTimeout(this.prepareContextUnbounded(input, recentMessages), input.timeoutMs ?? 250, fallback);
  }

  private async prepareContextUnbounded(
    input: PrepareHumanMemoryContextInput,
    recentMessages: HumanMemoryMessage[],
  ): Promise<PreparedHumanMemoryContext> {
    const [coreMemory, storedMemories] = await Promise.all([
      this.getCoreMemory(),
      this.getEpisodicMemories(),
    ]);

    const memories: EpisodicMemoryCandidate[] = storedMemories.map((memory) => ({
      content: memory.content,
      createdAt: memory.createdAt,
      embedding: memory.embedding,
      id: memory.id,
      importance: memory.importance,
      lastRecalledAt: memory.lastRecalledAt,
      strengthS: memory.strengthS,
    }));
    const recalledMemories = rankEpisodicMemories({
      memories,
      query: input.userMessage,
      queryEmbedding: input.queryEmbedding,
    });

    if (recalledMemories.length > 0) {
      void this.reinforceRecalledMemories(recalledMemories.map((memory) => memory.id)).catch(
        (error) => log('Failed to reinforce recalled memories: %O', error),
      );
    }

    return {
      coreMemory,
      memoryPrompt: buildHumanMemoryPrompt({
        coreMemory,
        recalledMemories,
      }),
      recalledMemories,
      recentMessages,
    };
  }

  /**
   * Schedule post-response memory work without delaying the streaming response.
   */
  schedulePostReply(
    input: HumanMemoryExtractionInput,
    provider?: HumanMemoryExtractionProvider,
  ): void {
    if (!provider) return;
    void this.persistAfterCompletion(input, provider).catch((error) => {
      log('Post-reply memory persistence failed: %O', error);
    });
  }

  async persistAfterCompletion(
    input: HumanMemoryExtractionInput,
    provider: HumanMemoryExtractionProvider,
  ): Promise<void> {
    const pureConversation = {
      assistantReply: input.assistantReply,
      sourceTopicId: input.sourceTopicId,
      userMessage: input.userMessage,
    };

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
        await this.updateCoreMemory(applyCoreMemoryOperations(current, operations.operations));
      } catch (error) {
        log('Core memory update failed: %O', error);
      }
    }

    if (provider.extractEpisodicMemories) {
      try {
        const extracted = await provider.extractEpisodicMemories({
          conversation: pureConversation,
        });
        for (const candidate of extracted) {
          const content = candidate.content.trim();
          if (!content) continue;
          const embedding = candidate.embedding ?? (await provider.embed?.(content));
          await this.upsertEpisodicMemory({
            content,
            embedding,
            importance: candidate.importance,
            sourceTopicId: input.sourceTopicId,
          });
        }
      } catch (error) {
        log('Episodic memory update failed: %O', error);
      }
    }
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
    const [topic] = await this.db
      .select({ memoryMigrated: topics.memoryMigrated })
      .from(topics)
      .where(and(eq(topics.id, input.sourceTopicId), eq(topics.userId, this.userId)))
      .limit(1);
    if (!topic || topic.memoryMigrated) return;

    const recentMessageCount =
      Math.max(0, Math.floor(input.windowSize ?? DEFAULT_HUMAN_MEMORY_WINDOW_SIZE)) * 2;
    const historicalMessages = input.messages.slice(0, -recentMessageCount || undefined);
    const chunkSize = 20;

    for (let start = 0; start < historicalMessages.length; start += chunkSize) {
      const chunk = historicalMessages.slice(start, start + chunkSize);
      const transcript = formatMemoryTranscript(chunk);
      if (!transcript) continue;

      await this.persistAfterCompletion(
        {
          assistantReply: '',
          sourceTopicId: input.sourceTopicId,
          userMessage: transcript,
        },
        input.provider!,
      );
    }

    await this.db
      .update(topics)
      .set({ memoryMigrated: true })
      .where(
        and(
          eq(topics.id, input.sourceTopicId),
          eq(topics.userId, this.userId),
          eq(topics.memoryMigrated, false),
        ),
      );
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
  }: {
    content: string;
    embedding?: number[];
    importance?: number;
    sourceTopicId?: string;
  }): Promise<void> {
    const existing = await this.getEpisodicMemories();
    const duplicate = existing.find((memory) => {
      const vectorMatch =
        embedding && memory.embedding
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
      return (vectorMatch ?? textSimilarity(content, memory.content)) >= DEFAULT_DEDUPLICATION_THRESHOLD;
    });

    if (duplicate) {
      await this.db
        .update(userEpisodicMemories)
        .set({
          content: content.length > duplicate.content.length ? content : duplicate.content,
          embedding: embedding ?? duplicate.embedding,
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
      importance: Math.max(0.1, Math.min(1, importance ?? 0.5)),
      sourceTopicId,
      userId: this.userId,
    });
  }
}

export * from './logic';
