import type { BuiltinServerRuntimeOutput } from '@lobechat/types';

import type { ImageGenerationService } from '../types';
import { GenerateImageParamsSchema } from '../types';

export class ImageGenerationExecutionRuntime {
  constructor(private service: ImageGenerationService) {}

  generateImage = async (
    params: unknown,
    options?: { signal?: AbortSignal },
  ): Promise<BuiltinServerRuntimeOutput> => {
    const parsed = GenerateImageParamsSchema.safeParse(params);
    if (!parsed.success) {
      const message =
        'Provide a non-empty image prompt (up to 16000 characters) and at most 8 image file IDs.';
      return { content: message, error: { code: 'INVALID_ARGUMENT', message }, success: false };
    }
    try {
      options?.signal?.throwIfAborted();
      const state = await this.service.generateImage(parsed.data, options);
      if (!state.images.length) throw new Error('The image provider returned no image.');
      return {
        content: [
          `Generated ${state.images.length} image using ${state.provider}/${state.model}.`,
          ...state.images.map((image) => `Image file ID: ${image.fileId}\nImage URL: ${image.url}`),
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
