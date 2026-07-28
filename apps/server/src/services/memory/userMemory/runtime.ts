import type { LobeChatDatabase } from '@lobechat/database';
import type { ClientSecretPayload, UserMemorySettings } from '@lobechat/types';
import { eq } from 'drizzle-orm';
import { ModelProvider } from 'model-bank';

import { userSettings } from '@/database/schemas';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';
import { initModelRuntimeWithUserPayload } from '@/server/modules/ModelRuntime';

import type { UserMemoryEmbeddingRuntime } from './embedding';
import type { UserMemoryTextModelRuntime } from './textModel';

export interface UserMemoryEmbeddingRuntimeOverride {
  model: string;
  payload: ClientSecretPayload;
  provider: string;
}

export interface ResolvedUserMemoryEmbeddingRuntime {
  model: string;
  runtime: UserMemoryEmbeddingRuntime;
}

export interface ResolvedUserMemoryTextModelRuntime {
  model: string;
  runtime: UserMemoryTextModelRuntime;
}

interface ResolveUserMemoryEmbeddingRuntimeOptions {
  override?: UserMemoryEmbeddingRuntimeOverride;
  serverDB: LobeChatDatabase;
  userId: string;
}

interface ResolveUserMemoryTextModelRuntimeOptions {
  serverDB: LobeChatDatabase;
  userId: string;
}

export const normalizeOpenAICompatibleBaseURL = (value: string) =>
  value
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(?:embeddings|chat\/completions|responses)$/i, '');

export const resolveUserMemoryEmbeddingRuntime = async ({
  override,
  serverDB,
  userId,
}: ResolveUserMemoryEmbeddingRuntimeOptions): Promise<
  ResolvedUserMemoryEmbeddingRuntime | undefined
> => {
  if (override) {
    return {
      model: override.model,
      runtime: initModelRuntimeWithUserPayload(override.provider, override.payload, { userId }),
    };
  }

  const settings = await serverDB.query.userSettings.findFirst({
    columns: { keyVaults: true, memory: true },
    where: eq(userSettings.id, userId),
  });
  const memorySettings = settings?.memory as UserMemorySettings | null | undefined;
  const embeddingSettings = memorySettings?.embedding;

  if (embeddingSettings?.enabled !== true) return undefined;

  const model = embeddingSettings.model?.trim();
  if (!model) throw new Error('Memory embedding model is required');

  const keyVaults = await KeyVaultsGateKeeper.getUserKeyVaults(settings?.keyVaults ?? null, userId);
  const apiKey = keyVaults.memoryEmbedding?.apiKey?.trim();
  const baseURL = normalizeOpenAICompatibleBaseURL(keyVaults.memoryEmbedding?.baseURL ?? '');

  if (!baseURL) throw new Error('Memory embedding BaseURL is required');
  if (!apiKey) throw new Error('Memory embedding API key is required');

  return {
    model,
    runtime: initModelRuntimeWithUserPayload(ModelProvider.OpenAI, { apiKey, baseURL }, { userId }),
  };
};

export const resolveUserMemoryTextModelRuntime = async ({
  serverDB,
  userId,
}: ResolveUserMemoryTextModelRuntimeOptions): Promise<
  ResolvedUserMemoryTextModelRuntime | undefined
> => {
  const settings = await serverDB.query.userSettings.findFirst({
    columns: { keyVaults: true, memory: true },
    where: eq(userSettings.id, userId),
  });
  const memorySettings = settings?.memory as UserMemorySettings | null | undefined;
  const textModelSettings = memorySettings?.textModel;

  if (textModelSettings?.enabled !== true) return undefined;

  const model = textModelSettings.model?.trim();
  if (!model) throw new Error('Memory text model is required');

  const keyVaults = await KeyVaultsGateKeeper.getUserKeyVaults(settings?.keyVaults ?? null, userId);
  const apiKey = keyVaults.memoryTextModel?.apiKey?.trim();
  const baseURL = normalizeOpenAICompatibleBaseURL(keyVaults.memoryTextModel?.baseURL ?? '');

  if (!baseURL) throw new Error('Memory text model BaseURL is required');
  if (!apiKey) throw new Error('Memory text model API key is required');

  return {
    model,
    runtime: initModelRuntimeWithUserPayload(ModelProvider.OpenAI, { apiKey, baseURL }, { userId }),
  };
};

export const resolveUserMemoryEmbeddingRuntimeWithFallback = async (
  options: ResolveUserMemoryEmbeddingRuntimeOptions,
) => {
  try {
    return await resolveUserMemoryEmbeddingRuntime(options);
  } catch (error) {
    console.error('[user-memory] failed to initialize embedding runtime; using keyword search', {
      error,
    });
    return undefined;
  }
};

export const resolveUserMemoryTextModelRuntimeWithFallback = async (
  options: ResolveUserMemoryTextModelRuntimeOptions,
) => {
  try {
    return await resolveUserMemoryTextModelRuntime(options);
  } catch (error) {
    console.error(
      '[user-memory] failed to initialize text model runtime; using native memory flow',
      {
        error,
      },
    );
    return undefined;
  }
};
