import type { SearchMemoryResult } from '@lobechat/types';
import { LayersEnum } from '@lobechat/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResolvedUserMemoryTextModelRuntime } from '../runtime';
import { selectRelevantUserMemories } from '../textModel';

const createCandidates = (...ids: string[]): SearchMemoryResult => ({
  activities: [],
  contexts: [],
  experiences: [],
  identities: [],
  preferences: ids.map((id) => ({ id }) as SearchMemoryResult['preferences'][number]),
});

const createRuntime = (generateObject: ReturnType<typeof vi.fn>) =>
  ({
    model: 'memory-text-model',
    runtime: { generateObject },
  }) as ResolvedUserMemoryTextModelRuntime;

describe('selectRelevantUserMemories', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns only valid candidate IDs in model relevance order', async () => {
    const generateObject = vi.fn().mockResolvedValue({
      matches: [
        { key: `${LayersEnum.Preference}:second`, score: 0.95 },
        { key: `${LayersEnum.Preference}:first`, score: 0.7 },
      ],
    });

    const result = await selectRelevantUserMemories({
      candidates: createCandidates('first', 'second'),
      params: { queries: ['what does the user prefer?'], topK: { preferences: 2 } },
      resolvedRuntime: createRuntime(generateObject),
      userId: 'user-1',
    });

    expect(result?.preferences.map((item) => item.id)).toEqual(['second', 'first']);
  });

  it('rejects a selection containing IDs outside the supplied candidate set', async () => {
    const generateObject = vi.fn().mockResolvedValue({
      matches: [
        { key: `${LayersEnum.Preference}:first`, score: 0.9 },
        { key: `${LayersEnum.Preference}:not-a-candidate`, score: 1 },
      ],
    });

    const result = await selectRelevantUserMemories({
      candidates: createCandidates('first'),
      params: { queries: ['what does the user prefer?'] },
      resolvedRuntime: createRuntime(generateObject),
      userId: 'user-1',
    });

    expect(result).toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      '[user-memory] text model selection failed; using hybrid search result',
      expect.objectContaining({
        message: 'Memory text model returned a selection outside the candidate set',
      }),
    );
  });

  it('falls back when the text model request fails', async () => {
    const generateObject = vi.fn().mockRejectedValue(new Error('upstream unavailable'));

    const result = await selectRelevantUserMemories({
      candidates: createCandidates('first'),
      params: { queries: ['what does the user prefer?'] },
      resolvedRuntime: createRuntime(generateObject),
      userId: 'user-1',
    });

    expect(result).toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      '[user-memory] text model selection failed; using hybrid search result',
      expect.objectContaining({ message: 'upstream unavailable' }),
    );
  });
});
