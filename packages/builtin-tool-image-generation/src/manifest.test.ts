import { describe, expect, it } from 'vitest';

import { ImageGenerationManifest } from './manifest';

describe('ImageGenerationManifest', () => {
  it('exposes one strict image API without model or provider override parameters', () => {
    expect(ImageGenerationManifest.executors).toEqual(['server']);
    expect(ImageGenerationManifest.api).toHaveLength(1);
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
  });
});
