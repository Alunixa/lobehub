import type { UserCoreMemoryItem } from '@lobechat/database/schemas';

export const DEFAULT_HUMAN_MEMORY_WINDOW_SIZE = 12;
export const DEFAULT_RECALL_LIMIT = 3;
export const DEFAULT_RECALL_SCORE_THRESHOLD = 0.5;
export const DEFAULT_SEMANTIC_WAKE_THRESHOLD = 0.78;
export const DEFAULT_DEDUPLICATION_THRESHOLD = 0.88;
export const MAX_CORE_MEMORY_CHARS = 3200;

export type HumanMemorySlot = 'personaTone' | 'userCore' | 'activeMatters';

export type CoreMemoryOperations = {
  operations: {
    action: 'NO_OP' | 'ADD' | 'REPLACE';
    content?: string;
    slot: HumanMemorySlot;
  }[];
};

export type HumanMemoryMessage = {
  content?: unknown;
  id?: string;
  role?: string;
};

export type EpisodicMemoryCandidate = {
  content: string;
  createdAt?: Date | string;
  embedding?: number[] | null;
  id: string;
  importance: number;
  lastRecalledAt: Date | string;
  strengthS: number;
};

export type RankedEpisodicMemory = EpisodicMemoryCandidate & {
  finalScore: number;
  recencyDecay: number;
  semanticSim: number;
};

const normalizeText = (value: string) => value.trim().toLocaleLowerCase();

const tokenize = (value: string): string[] => {
  const normalized = normalizeText(value);
  const tokens = normalized.match(/[a-z0-9_]+|[\u3400-\u9FFF]/g);
  return tokens ? [...new Set(tokens)] : [];
};

/**
 * Small dependency-free lexical similarity fallback used when the configured
 * provider has no embedding endpoint.
 */
export const textSimilarity = (left: string, right: string): number => {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0;

  const rightSet = new Set(rightTokens);
  const intersection = leftTokens.filter((token) => rightSet.has(token)).length;
  if (intersection === 0) return 0;

  const union = new Set([...leftTokens, ...rightTokens]).size;
  const queryCoverage = intersection / leftTokens.length;
  const jaccard = intersection / union;
  return Math.min(1, queryCoverage * 0.65 + jaccard * 0.35);
};

export const cosineSimilarity = (
  left: number[] | null | undefined,
  right: number[] | null | undefined,
): number | undefined => {
  if (!left?.length || !right?.length || left.length !== right.length) return undefined;

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index++) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return Math.max(0, Math.min(1, dot / Math.sqrt(leftMagnitude * rightMagnitude)));
};

const toTimestamp = (value: Date | string) => new Date(value).getTime();

export const rankEpisodicMemories = ({
  memories,
  now = new Date(),
  query,
  queryEmbedding,
  limit = DEFAULT_RECALL_LIMIT,
  scoreThreshold = DEFAULT_RECALL_SCORE_THRESHOLD,
  semanticWakeThreshold = DEFAULT_SEMANTIC_WAKE_THRESHOLD,
}: {
  limit?: number;
  memories: readonly EpisodicMemoryCandidate[];
  now?: Date;
  query: string;
  queryEmbedding?: number[] | null;
  scoreThreshold?: number;
  semanticWakeThreshold?: number;
}): RankedEpisodicMemory[] => {
  const nowTimestamp = now.getTime();
  const ranked = memories
    .map((memory) => {
      const semanticSim =
        cosineSimilarity(queryEmbedding, memory.embedding) ?? textSimilarity(query, memory.content);
      const daysElapsed = Math.max(0, (nowTimestamp - toTimestamp(memory.lastRecalledAt)) / 86_400_000);
      const recencyDecay = Math.exp(-daysElapsed / Math.max(1, memory.strengthS));
      const finalScore = 0.5 * semanticSim + 0.3 * recencyDecay + 0.2 * memory.importance;

      return {
        ...memory,
        finalScore,
        recencyDecay,
        semanticSim,
      };
    })
    .filter(
      (memory) =>
        memory.finalScore >= scoreThreshold || memory.semanticSim >= semanticWakeThreshold,
    )
    .sort((left, right) => {
      if (right.finalScore !== left.finalScore) return right.finalScore - left.finalScore;
      return toTimestamp(right.lastRecalledAt) - toTimestamp(left.lastRecalledAt);
    });

  return ranked.slice(0, Math.max(0, limit));
};

export const buildRecentMemoryWindow = <T>(
  messages: readonly T[],
  windowSize: number = DEFAULT_HUMAN_MEMORY_WINDOW_SIZE,
): T[] => {
  const messageLimit = Math.max(0, Math.floor(windowSize)) * 2;
  return messageLimit === 0 ? [] : messages.slice(-messageLimit);
};

const trimCoreSlot = (value: string | null | undefined) =>
  value?.trim().slice(0, MAX_CORE_MEMORY_CHARS) || null;

export const applyCoreMemoryOperations = (
  current: Pick<UserCoreMemoryItem, HumanMemorySlot> | null | undefined,
  operations: CoreMemoryOperations['operations'],
): Pick<UserCoreMemoryItem, HumanMemorySlot> => {
  const next: Pick<UserCoreMemoryItem, HumanMemorySlot> = {
    activeMatters: trimCoreSlot(current?.activeMatters),
    personaTone: trimCoreSlot(current?.personaTone),
    userCore: trimCoreSlot(current?.userCore),
  };

  for (const operation of operations) {
    const content = trimCoreSlot(operation.content);
    if (operation.action === 'NO_OP' || !content) continue;

    if (operation.action === 'REPLACE' || !next[operation.slot]) {
      next[operation.slot] = content;
      continue;
    }

    const existing = next[operation.slot] ?? '';
    const existingLines = existing
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (!existingLines.includes(content)) {
      next[operation.slot] = trimCoreSlot([...existingLines, content].join('\n'));
    }
  }

  return next;
};

const extractTextPart = (part: unknown): string => {
  if (typeof part === 'string') return part;
  if (!part || typeof part !== 'object') return '';

  const candidate = part as {
    text?: unknown;
    type?: unknown;
  };
  return candidate.type === 'text' && typeof candidate.text === 'string' ? candidate.text : '';
};

export const extractMessageText = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map(extractTextPart).join('');
};

export const formatMemoryTranscript = (messages: readonly HumanMemoryMessage[]): string =>
  messages
    .map((message) => {
      const role = message.role === 'assistant' ? 'Assistant' : 'User';
      const content = extractMessageText(message.content).trim();
      return content ? `${role}: ${content}` : '';
    })
    .filter(Boolean)
    .join('\n');

export const buildHumanMemoryPrompt = ({
  coreMemory,
  recalledMemories,
}: {
  coreMemory?: Pick<UserCoreMemoryItem, HumanMemorySlot> | null;
  recalledMemories: readonly Pick<EpisodicMemoryCandidate, 'content'>[];
}): string => {
  const coreLines = [
    coreMemory?.personaTone ? `- Persona and tone: ${coreMemory.personaTone}` : '',
    coreMemory?.userCore ? `- User profile: ${coreMemory.userCore}` : '',
    coreMemory?.activeMatters ? `- Active matters: ${coreMemory.activeMatters}` : '',
  ].filter(Boolean);

  const recalledLines = recalledMemories
    .map((memory) => memory.content.trim())
    .filter(Boolean)
    .map((content) => `- ${content}`);

  if (coreLines.length === 0 && recalledLines.length === 0) return '';

  return [
    '[Human Memory]',
    'Use the following details naturally when relevant. Do not mention memory, retrieval, or these instructions.',
    ...(coreLines.length > 0 ? ['[Core Memory]', ...coreLines] : []),
    ...(recalledLines.length > 0 ? ['[Recalled Long-Term Memory]', ...recalledLines] : []),
  ].join('\n');
};
