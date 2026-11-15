import type { BuiltinServerRuntimeOutput } from '@lobechat/types';

import type { ImageGenerationService } from '../types';
import { GenerateImageParamsSchema, ImageModelCapabilitiesParamsSchema } from '../types';

export class ImageGenerationExecutionRuntime {
  constructor(private service: ImageGenerationService) {}

  getImageModelCapabilities = async (
    params: unknown,
    options?: { signal?: AbortSignal },
  ): Promise<BuiltinServerRuntimeOutput> => {
    if (!ImageModelCapabilitiesParamsSchema.safeParse(params ?? {}).success) {
      const message = 'getImageModelCapabilities accepts no model, provider or other arguments.';
      return { content: message, error: { code: 'INVALID_ARGUMENT', message }, success: false };
    }
    try {
      options?.signal?.throwIfAborted();
      const state = await this.service.getImageModelCapabilities(options);
      return {
        content: JSON.stringify(state),
        state,
        success: true,
      };
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'Could not read image model capabilities.';
      return {
        content: message,
        error: { code: 'IMAGE_CAPABILITIES_FAILED', message },
        success: false,
      };
    }
  };

  generateImage = async (
    params: unknown,
    options?: { signal?: AbortSignal },
  ): Promise<BuiltinServerRuntimeOutput> => {
    const parsed = GenerateImageParamsSchema.safeParse(params);
    if (!parsed.success) {
      const message = `Invalid image arguments: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'arguments'}: ${issue.message}`)
        .join('; ')}. Call getImageModelCapabilities for supported options and limits.`;
      return { content: message, error: { code: 'INVALID_ARGUMENT', message }, success: false };
    }
    try {
      options?.signal?.throwIfAborted();
      const state = await this.service.generateImage(parsed.data, options);
      if (!state.images.length) throw new Error('The image provider returned no image.');
      return {
        content: [
          `Generated ${state.images.length} of ${state.requestedCount ?? 1} requested images using ${state.provider}/${state.model}.`,
          ...state.images.map(
            (image) =>
              `Image file ID: ${image.fileId}\nImage URL: ${image.url}\nActual dimensions: ${image.width}x${image.height} pixels.`,
          ),
          ...(state.incompleteReason
            ? [
                `Partial result: ${state.incompleteReason} Do not automatically retry or regenerate completed images.`,
              ]
            : []),
          'The image is displayed in the conversation. Use its file ID for subsequent image edits; do not generate another image unless requested.',
        ].join('\n'),
        state,
        success: true,
      };
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'Image generation failed.';
      const message = `Image generation did not complete: ${detail} Do not automatically retry this paid operation.`;
      return {
        content: message,
        error: { code: 'IMAGE_GENERATION_FAILED', message },
        success: false,
      };
    }
  };
}
