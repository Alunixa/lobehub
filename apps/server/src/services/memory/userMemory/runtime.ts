import type { LobeChatDatabase } from '@lobechat/database';
import type { ClientSecretPayload, UserMemorySettings } from '@lobechat/types';
import { eq } from 'drizzle-orm';
import { ModelProvider } from 'model-bank';

import { userSettings } from '@/database/schemas';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';
import { initModelRuntimeWithUserPayload } from '@/server/modules/ModelRuntime';

import type { UserMemoryEmbeddingRuntime } from './embedding';

export interface UserMemoryEmbeddingRuntimeOverride {
  model: string;
  payload: ClientSecretPayload;
  provider: string;
}

export interface ResolvedUserMemoryEmbeddingRuntime {
  model: string;
  runtime: UserMemoryEmbeddingRuntime;
}

interface ResolveUserMemoryEmbeddingRuntimeOptions {
  override?: UserMemoryEmbeddingRuntimeOverride;
  serverDB: LobeChatDatabase;
  userId: string;
}

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
  const baseURL = keyVaults.memoryEmbedding?.baseURL?.trim();

  if (!baseURL) throw new Error('Memory embedding BaseURL is required');
  if (!apiKey) throw new Error('Memory embedding API key is required');

  return {
    model,
    runtime: initModelRuntimeWithUserPayload(
      ModelProvider.OpenAI,
      { apiKey, baseURL },
      { userId },
    ),
  };
};
