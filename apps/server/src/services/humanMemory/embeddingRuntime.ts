import type { LobeChatDatabase } from '@lobechat/database';
import { and, eq, isNull } from 'drizzle-orm';

import { aiModels, aiProviders } from '@/database/schemas';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';
import { resolveUserMemoryEmbeddingRuntimeWithFallback } from '@/server/services/memory/userMemory/runtime';

/** Discover declared embedding capabilities; never send embedding requests to a chat model. */
export const resolveHumanMemoryEmbeddingRuntime = async (
  serverDB: LobeChatDatabase,
  userId: string,
  preferredModel?: string,
) => {
  if (!preferredModel?.trim()) {
    const configured = await resolveUserMemoryEmbeddingRuntimeWithFallback({ serverDB, userId });
    if (configured) return configured;
  }
  const [model] = await serverDB
    .select({
      model: aiModels.id,
      provider: aiModels.providerId,
    })
    .from(aiModels)
    .innerJoin(
      aiProviders,
      and(
        eq(aiProviders.id, aiModels.providerId),
        eq(aiProviders.userId, userId),
        isNull(aiProviders.workspaceId),
      ),
    )
    .where(
      and(
        eq(aiModels.userId, userId),
        isNull(aiModels.workspaceId),
        eq(aiModels.enabled, true),
        eq(aiProviders.enabled, true),
        eq(aiModels.type, 'embedding'),
        preferredModel ? eq(aiModels.id, preferredModel) : undefined,
      ),
    )
    .limit(1);
  if (!model) return undefined;
  return {
    model: model.model,
    runtime: await initModelRuntimeFromDB(serverDB, userId, model.provider, undefined, {
      maxRetries: 0,
    }),
  };
};
