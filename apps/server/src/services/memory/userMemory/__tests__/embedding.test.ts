import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserMemoryEmbeddingRuntime } from '../embedding';
import { embedUserMemoryTexts, embedUserMemoryTextsWithFallback } from '../embedding';

const mocks = vi.hoisted(() => ({
  contextLimit: 3 as number | undefined,
  encodeAsync: vi.fn(async (text: string) => text.split(/\s+/).filter(Boolean).length),
  trimBasedOnBatchProbe: vi.fn(async (text: string, limit?: number) =>
    text
      .split(/\s+/)
      .filter(Boolean)
      .slice(-(limit ?? 0))
      .join(' '),
  ),
}));

vi.mock('@/server/globalConfig/parseMemoryExtractionConfig', () => ({
  parseMemoryExtractionConfig: () => ({
    embedding: {
      contextLimit: mocks.contextLimit,
    },
  }),
}));

vi.mock('@/utils/chunkers', () => ({
  trimBasedOnBatchProbe: mocks.trimBasedOnBatchProbe,
}));

vi.mock('@/utils/tokenizer', () => ({
  encodeAsync: mocks.encodeAsync,
}));

describe('embedUserMemoryTexts', () => {
  beforeEach(() => {
    mocks.contextLimit = 3;
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('trims long inputs and preserves output indexes', async () => {
    const runtime = {
      embeddings: vi.fn(async () => [
        [1, 2, 3],
        [4, 5, 6],
      ]),
    } satisfies UserMemoryEmbeddingRuntime;

    const result = await embedUserMemoryTexts({
      input: ['one two three four', '', null, 'short text'],
      model: 'text-embedding-3-large',
      runtime,
      source: 'test:source',
      userId: 'user-test',
    });

    expect(runtime.embeddings).toHaveBeenCalledWith(
      {
        dimensions: 1024,
        input: ['two three four', 'short text'],
        model: 'text-embedding-3-large',
      },
      { metadata: { trigger: 'memory' }, user: 'user-test' },
    );
    expect(result).toEqual([[1, 2, 3], undefined, undefined, [4, 5, 6]]);
    expect(console.warn).toHaveBeenCalledWith('[user-memory] trimmed embedding input', {
      limit: 3,
      model: 'text-embedding-3-large',
      originalTokens: 4,
      source: 'test:source',
      trimmedTokens: 3,
      userId: 'user-test',
    });
  });

  it('skips trimming when no context limit is configured', async () => {
    mocks.contextLimit = undefined;
    const runtime = {
      embeddings: vi.fn(async () => [[1, 2, 3]]),
    } satisfies UserMemoryEmbeddingRuntime;

    const result = await embedUserMemoryTexts({
      input: ['one two three four'],
      model: 'text-embedding-3-large',
      runtime,
      source: 'test:no-limit',
      userId: 'user-test',
    });

    expect(mocks.trimBasedOnBatchProbe).not.toHaveBeenCalled();
    expect(runtime.embeddings).toHaveBeenCalledWith(
      {
        dimensions: 1024,
        input: ['one two three four'],
        model: 'text-embedding-3-large',
      },
      { metadata: { trigger: 'memory' }, user: 'user-test' },
    );
    expect(result).toEqual([[1, 2, 3]]);
  });

  it('returns empty vector slots when the embedding endpoint returns 404', async () => {
    const runtime = {
      embeddings: vi.fn().mockRejectedValue(new Error('404 bad response status code 404')),
    } satisfies UserMemoryEmbeddingRuntime;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await embedUserMemoryTextsWithFallback({
      input: ['first memory', 'second memory'],
      model: 'unsupported-embedding-model',
      runtime,
      source: 'test:404-fallback',
      userId: 'user-test',
    });

    expect(result).toEqual([undefined, undefined]);
    expect(consoleError).toHaveBeenCalledWith(
      '[user-memory] embedding unavailable; continuing without vectors',
      expect.objectContaining({
        model: 'unsupported-embedding-model',
        source: 'test:404-fallback',
      }),
    );
  });
});
