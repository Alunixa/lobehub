import type { LobeChatDatabase } from '@lobechat/database';
import { TypesEnum } from '@lobechat/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ToolExecutionContext } from '../../types';

const mocks = vi.hoisted(() => ({
  createPreferenceMemory: vi.fn(),
  embeddings: vi.fn(),
  initModelRuntimeFromDB: vi.fn(),
  initModelRuntimeWithUserPayload: vi.fn(),
  searchMemory: vi.fn(),
}));

vi.mock('@/database/models/userMemory', () => ({
  UserMemoryModel: vi.fn().mockImplementation(() => ({
    createPreferenceMemory: mocks.createPreferenceMemory,
    searchMemory: mocks.searchMemory,
  })),
}));

vi.mock('@/database/schemas', () => ({
  userSettings: { id: 'id' },
}));

vi.mock('@/server/globalConfig', () => ({
  getServerDefaultFilesConfig: vi.fn(() => ({
    embeddingModel: { model: 'default-embedding-model', provider: 'default-provider' },
  })),
}));

vi.mock('@/server/modules/ModelRuntime', () => ({
  initModelRuntimeFromDB: mocks.initModelRuntimeFromDB,
  initModelRuntimeWithUserPayload: mocks.initModelRuntimeWithUserPayload,
}));

vi.mock('@/server/services/agentSignal/procedure', () => ({
  emitToolOutcomeSafely: vi.fn(),
  resolveToolOutcomeScope: vi.fn(() => ({ scope: 'user', scopeKey: 'user-1' })),
}));

vi.mock('@/server/services/agentSignal/store/adapters/redis/policyStateStore', () => ({
  redisPolicyStateStore: {},
}));

const { memoryRuntime } = await import('../memory');

const createContext = (): ToolExecutionContext => ({
  memoryEmbeddingRuntime: {
    model: 'server-embedding-model',
    payload: {
      apiKey: 'server-key',
      baseURL: 'https://embedding.example.com/v1',
    },
    provider: 'server-provider',
  },
  serverDB: {
    query: {
      userSettings: {
        findFirst: vi.fn(async () => undefined),
      },
    },
  } as unknown as LobeChatDatabase,
  toolManifestMap: {},
  userId: 'synthetic-user',
});

describe('memoryRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses server-owned embedding runtime for memory search', async () => {
    mocks.embeddings.mockResolvedValueOnce([[0.1, 0.2, 0.3]]);
    mocks.initModelRuntimeWithUserPayload.mockReturnValueOnce({
      embeddings: mocks.embeddings,
    });
    mocks.searchMemory.mockResolvedValueOnce({
      activities: [],
      contexts: [],
      experiences: [],
      identities: [],
      preferences: [],
    });

    const runtime = await memoryRuntime.factory(createContext());

    await runtime.searchUserMemory({ queries: ['renewal timeline'] });

    expect(mocks.initModelRuntimeWithUserPayload).toHaveBeenCalledWith(
      'server-provider',
      {
        apiKey: 'server-key',
        baseURL: 'https://embedding.example.com/v1',
      },
      { userId: 'synthetic-user' },
    );
    expect(mocks.initModelRuntimeFromDB).not.toHaveBeenCalled();
    expect(mocks.embeddings).toHaveBeenCalledWith(
      expect.objectContaining({
        input: ['renewal timeline'],
        model: 'server-embedding-model',
      }),
      expect.objectContaining({ user: 'synthetic-user' }),
    );
    expect(mocks.searchMemory).toHaveBeenCalledWith(
      expect.objectContaining({ queries: ['renewal timeline'] }),
      [[0.1, 0.2, 0.3]],
    );
  });

  it('uses BM25-only search when account embeddings are disabled', async () => {
    const context = createContext();
    context.memoryEmbeddingRuntime = undefined;
    mocks.searchMemory.mockResolvedValueOnce({
      activities: [],
      contexts: [],
      experiences: [],
      identities: [],
      preferences: [],
    });

    const runtime = await memoryRuntime.factory(context);

    await runtime.searchUserMemory({ queries: ['renewal timeline'] });

    expect(mocks.initModelRuntimeWithUserPayload).not.toHaveBeenCalled();
    expect(mocks.embeddings).not.toHaveBeenCalled();
    expect(mocks.searchMemory).toHaveBeenCalledWith(
      expect.objectContaining({ queries: ['renewal timeline'] }),
      [],
    );
  });

  it('falls back to BM25 when embedding runtime initialization fails with 404', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.initModelRuntimeWithUserPayload.mockImplementationOnce(() => {
      throw new Error('404 model endpoint not found');
    });
    mocks.searchMemory.mockResolvedValueOnce({
      activities: [],
      contexts: [],
      experiences: [],
      identities: [],
      preferences: [],
    });

    const runtime = await memoryRuntime.factory(createContext());
    const result = await runtime.searchUserMemory({ queries: ['renewal timeline'] });

    expect(result.success).toBe(true);
    expect(mocks.searchMemory).toHaveBeenCalledWith(
      expect.objectContaining({ queries: ['renewal timeline'] }),
      [],
    );
    consoleError.mockRestore();
  });

  it('falls back to BM25 when the embedding request returns 404', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.embeddings.mockRejectedValueOnce(new Error('404 bad response status code 404'));
    mocks.initModelRuntimeWithUserPayload.mockReturnValueOnce({
      embeddings: mocks.embeddings,
    });
    mocks.searchMemory.mockResolvedValueOnce({
      activities: [],
      contexts: [],
      experiences: [],
      identities: [],
      preferences: [],
    });

    const runtime = await memoryRuntime.factory(createContext());
    const result = await runtime.searchUserMemory({ queries: ['renewal timeline'] });

    expect(result.success).toBe(true);
    expect(mocks.searchMemory).toHaveBeenCalledWith(
      expect.objectContaining({ queries: ['renewal timeline'] }),
      [],
    );
    consoleError.mockRestore();
  });

  it('saves the original memory without vectors when the embedding request returns 404', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.embeddings.mockRejectedValue(new Error('404 bad response status code 404'));
    mocks.initModelRuntimeWithUserPayload.mockReturnValue({
      embeddings: mocks.embeddings,
    });
    mocks.createPreferenceMemory.mockResolvedValueOnce({
      memory: { id: 'memory-1' },
      preference: { id: 'preference-1' },
    });

    const runtime = await memoryRuntime.factory(createContext());
    const result = await runtime.addPreferenceMemory({
      details: 'The user specifically likes jasmine tea after lunch.',
      memoryCategory: 'personal',
      memoryType: TypesEnum.Preference,
      sourceIds: ['message-1'],
      summary: 'Likes jasmine tea after lunch',
      tags: ['tea'],
      title: 'Tea preference',
      withPreference: {
        appContext: null,
        conclusionDirectives: 'Offer jasmine tea after lunch.',
        extractedLabels: ['tea'],
        extractedScopes: ['food'],
        originContext: null,
        scorePriority: 0.8,
        suggestions: ['Remember this drink preference'],
        type: 'food',
      },
    });

    expect(result.success).toBe(true);
    expect(mocks.createPreferenceMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        details: 'The user specifically likes jasmine tea after lunch.',
        detailsEmbedding: undefined,
        preference: expect.objectContaining({
          conclusionDirectives: 'Offer jasmine tea after lunch.',
          conclusionDirectivesVector: null,
        }),
        summary: 'Likes jasmine tea after lunch',
        summaryEmbedding: undefined,
        title: 'Tea preference',
      }),
    );
    consoleError.mockRestore();
  });
});
