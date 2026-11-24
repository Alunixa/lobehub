import { describe, expect, it } from 'vitest';

import { getUserMemoryRetrievalMode, isConfiguredUserMemoryEmbedding } from './runtime';

describe('user memory embedding status', () => {
  it('recognizes the local bge-m3 embedding configuration as semantic retrieval', () => {
    const configured = isConfiguredUserMemoryEmbedding(
      {
        embedding: { enabled: true, model: 'bge-m3' },
      },
      {
        memoryEmbedding: {
          apiKey: 'sk-local',
          baseURL: 'http://lobe-ollama-embed:11434/v1',
        },
      },
    );

    expect(getUserMemoryRetrievalMode(configured, 'keyword')).toBe('semantic');
  });
});
