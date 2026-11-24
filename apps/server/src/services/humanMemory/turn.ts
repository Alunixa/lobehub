import type { LobeChatDatabase } from '@lobechat/database';
import type { UserMemorySettings } from '@lobechat/types';

import { UserModel } from '@/database/models/user';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';

import { HumanMemoryService } from './index';
import { createHumanMemoryExtractionProvider } from './provider';

/** Client/direct HTTP completions share the same background extraction contract. */
export const scheduleHumanMemoryTurn = (input: {
  assistantReply: string;
  db: LobeChatDatabase;
  model: string;
  provider: string;
  topicId?: string;
  userId: string;
  userMessage: string;
  workspaceId?: string;
}) => {
  void (async () => {
    if (!input.userMessage.trim() || !input.assistantReply.trim()) return;
    const settings = (await new UserModel(input.db, input.userId).getUserSettings())?.memory as
      UserMemorySettings | undefined;
    if (!settings?.humanMemoryEnabled) return;
    const current = await initModelRuntimeFromDB(
      input.db,
      input.userId,
      input.provider,
      input.workspaceId,
      { maxRetries: 0 },
    );
    const provider = await createHumanMemoryExtractionProvider({
      embeddingModel: settings.humanMemoryEmbeddingModel,
      serverDB: input.db,
      textModel: settings.humanMemoryModel,
      textRuntime: current ? { model: input.model, runtime: current } : undefined,
      userId: input.userId,
    });
    const service = new HumanMemoryService(input.db, input.userId);
    if (!provider) return;
    service.schedulePostReply(
      {
        assistantReply: input.assistantReply,
        sourceTopicId: input.topicId,
        userMessage: input.userMessage,
      },
      provider,
    );
    if (input.topicId)
      service.scheduleLazyBackfill({
        messages: [],
        provider,
        sourceTopicId: input.topicId,
        windowSize: settings.humanMemoryWindowSize,
      });
  })().catch((error) => {
    console.error('[human-memory] background turn failed', {
      name: error instanceof Error ? error.name : 'Error',
    });
  });
};
