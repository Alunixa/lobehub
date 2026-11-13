import type { ModelParamsSchema } from 'model-bank';
import { CHAT_MODEL_IMAGE_GENERATION_PARAMS } from 'model-bank';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as modelProperties from './getFallbackModelProperty';
import { resolveImageModelParameters } from './resolveImageModelParameters';

const canonical: ModelParamsSchema = {
  imageUrls: { default: [], maxCount: 16, maxFileSize: 50 * 1024 * 1024 },
  prompt: { default: '' },
  size: { default: 'auto', enum: ['auto', '1024x1024'] },
};

describe('resolveImageModelParameters', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(['gpt-image-2', 'gpt-image-2.6-sunburst'])(
    'restores reference capabilities for custom provider %s with an empty schema',
    async (id) => {
      vi.spyOn(modelProperties, 'getModelPropertyWithFallback').mockImplementation(async (model) =>
        model === (id === 'gpt-image-2' ? id : 'gpt-image-2') ? canonical : undefined,
      );
      expect(
        await resolveImageModelParameters({
          id,
          parameters: {} as ModelParamsSchema,
          providerId: 'image',
        }),
      ).toEqual(canonical);
    },
  );

  it('preserves explicit model constraints over canonical defaults without mutating them', async () => {
    vi.spyOn(modelProperties, 'getModelPropertyWithFallback').mockResolvedValue(canonical);
    const override = {
      imageUrls: { default: [], maxCount: 2 },
      prompt: { default: '' },
    } as ModelParamsSchema;
    const result = await resolveImageModelParameters({ id: 'gpt-image-2', parameters: override });
    expect(result.imageUrls?.maxCount).toBe(2);
    expect(result.size).toEqual(canonical.size);
    expect(canonical.imageUrls?.maxCount).toBe(16);
    expect(override.prompt).toEqual({ default: '' });
  });

  it('resolves the image variant of a chat-backed image model', async () => {
    vi.spyOn(modelProperties, 'getModelPropertyWithFallback').mockImplementation(async (id) =>
      id === 'compatible-gemini:image' ? canonical : undefined,
    );
    expect(await resolveImageModelParameters({ id: 'compatible-gemini' })).toEqual(canonical);
  });

  it('does not invent image input support for a known text-to-image model', async () => {
    const textOnly = { prompt: { default: '' } };
    vi.spyOn(modelProperties, 'getModelPropertyWithFallback').mockResolvedValue(textOnly);
    expect(await resolveImageModelParameters({ id: 'dall-e-3' })).toEqual(textOnly);
  });

  it('retains the explicit single-image schema of an unknown model', async () => {
    vi.spyOn(modelProperties, 'getModelPropertyWithFallback').mockResolvedValue(undefined);
    const inline = { imageUrl: { default: null }, prompt: { default: '' } };
    expect(await resolveImageModelParameters({ id: 'custom-editor', parameters: inline })).toEqual(
      inline,
    );
  });

  it('keeps the existing generic fallback when no metadata is available at all', async () => {
    vi.spyOn(modelProperties, 'getModelPropertyWithFallback').mockResolvedValue(undefined);
    expect(await resolveImageModelParameters({ id: 'unknown' })).toEqual(
      CHAT_MODEL_IMAGE_GENERATION_PARAMS,
    );
    expect(
      await resolveImageModelParameters({
        id: 'unknown',
        parameters: {} as ModelParamsSchema,
      }),
    ).toEqual(CHAT_MODEL_IMAGE_GENERATION_PARAMS);
  });
});
