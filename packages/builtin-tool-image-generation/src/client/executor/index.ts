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

  private createRuntime(ctx: BuiltinToolContext) {
    return new ImageGenerationExecutionRuntime({
      getImageModelCapabilities: async (options) => {
        if (!ctx.topicId)
          throw new Error('A conversation is required for image model capabilities.');
        return conversationImageService.getImageModelCapabilities(ctx.topicId, options);
      },
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
  }

  getImageModelCapabilities = async (
    params: unknown,
    ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> =>
    this.toResult(
      await this.createRuntime(ctx).getImageModelCapabilities(params, { signal: ctx.signal }),
    );

  generateImage = async (
    params: GenerateImageParams,
    ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> => {
    const runtime = this.createRuntime(ctx);
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
