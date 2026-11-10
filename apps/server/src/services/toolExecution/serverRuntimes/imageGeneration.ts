import { ImageGenerationIdentifier } from '@lobechat/builtin-tool-image-generation';
import { ImageGenerationExecutionRuntime } from '@lobechat/builtin-tool-image-generation/executionRuntime';

import { ConversationImageGenerationService } from '@/server/services/conversationImage';

import type { ServerRuntimeRegistration } from './types';

export const imageGenerationRuntime: ServerRuntimeRegistration = {
  factory: (context) => {
    if (!context.serverDB || !context.userId || !context.topicId || !context.toolCallId) {
      throw new Error(
        'A user, database, conversation and tool call ID are required for image generation.',
      );
    }
    return new ImageGenerationExecutionRuntime(
      new ConversationImageGenerationService({
        agentVisibility: context.agentVisibility,
        operationId: context.operationId,
        requestId: `${context.operationId ?? ''}:${context.toolCallId}`,
        serverDB: context.serverDB,
        topicId: context.topicId,
        userId: context.userId,
        workspaceId: context.workspaceId,
      }),
    );
  },
  identifier: ImageGenerationIdentifier,
};
