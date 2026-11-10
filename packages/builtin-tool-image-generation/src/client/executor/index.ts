import type {
  BuiltinServerRuntimeOutput,
  BuiltinToolContext,
  BuiltinToolResult,
} from '@lobechat/types';
import { BaseExecutor } from '@lobechat/types';

import { conversationImageService } from '@/services/conversationImage';

import { ImageGenerationExecutionRuntime } from '../../ExecutionRuntime';
import type { GenerateImageParams } from '../../types';
import { ImageGenerationApiName, ImageGenerationIdentifier } from '../../types';

class ImageGenerationExecutor extends BaseExecutor<typeof ImageGenerationApiName> {
  readonly identifier = ImageGenerationIdentifier;
  protected readonly apiEnum = ImageGenerationApiName;

  generateImage = async (
    params: GenerateImageParams,
    ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> => {
    const runtime = new ImageGenerationExecutionRuntime({
      generateImage: async (input, options) => {
        if (!ctx.topicId) throw new Error('A conversation is required for image generation.');
        return conversationImageService.generateImage(
          {
            ...input,
            requestId: ctx.toolCallId ?? ctx.messageId,
            topicId: ctx.topicId,
          },
          options,
        );
      },
    });
    return this.toResult(await runtime.generateImage(params, { signal: ctx.signal }));
  };

  private toResult(output: BuiltinServerRuntimeOutput): BuiltinToolResult {
    const content = output.content || 'Image generation failed.';
    return {
      content,
      error: output.success
        ? undefined
        : { body: output.error, message: content, type: 'PluginServerError' },
      state: output.state,
      success: output.success,
    };
  }
}

export const imageGenerationExecutor = new ImageGenerationExecutor();
