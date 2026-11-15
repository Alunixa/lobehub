import { describe, expect, it } from 'vitest';

import { ImageGenerationManifest } from './manifest';

describe('ImageGenerationManifest', () => {
  it('exposes capability discovery and strict structured generation without model or provider overrides', () => {
    expect(ImageGenerationManifest.executors).toEqual(['server']);
    expect(ImageGenerationManifest.api).toHaveLength(2);
    expect(ImageGenerationManifest.api[0]).toMatchObject({
      name: 'generateImage',
      parameters: {
        additionalProperties: false,
        required: ['prompt'],
      },
    });
    expect(ImageGenerationManifest.api[0].parameters.properties).toHaveProperty(
      'referenceImageFileIds',
    );
    expect(ImageGenerationManifest.api[0].parameters.properties).not.toHaveProperty('model');
    expect(ImageGenerationManifest.api[0].parameters.properties).not.toHaveProperty('provider');
    expect(ImageGenerationManifest.api[0].parameters.properties).toHaveProperty('options');
    expect(ImageGenerationManifest.api[0].parameters.properties).toHaveProperty('imageNum');
    expect(ImageGenerationManifest.api[1]).toMatchObject({
      name: 'getImageModelCapabilities',
      parameters: { additionalProperties: false },
    });
  });
});
