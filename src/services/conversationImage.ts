import type { GenerateImageParams } from '@lobechat/builtin-tool-image-generation';

import { lambdaClient } from '@/libs/trpc/client';

class ConversationImageService {
  async generateImage(
    params: GenerateImageParams & { requestId: string; topicId: string },
    options?: { signal?: AbortSignal },
  ) {
    const result = await lambdaClient.image.generateInConversation.mutate(params, options);
    return result.data;
  }
}

export const conversationImageService = new ConversationImageService();
