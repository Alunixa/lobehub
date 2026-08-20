import { describe, expect, it } from 'vitest';

import { gptImage1Schema, gptImage2Schema } from './imageParameters';

describe('GPT image parameter schemas', () => {
  it('should allow multiple reference images for GPT image models', () => {
    expect(gptImage1Schema.imageUrls?.maxCount).toBe(16);
    expect(gptImage2Schema.imageUrls?.maxCount).toBe(16);
    expect(gptImage2Schema.imageUrls?.maxFileSize).toBe(50 * 1024 * 1024);
  });

  it('should expose custom dimensions for GPT Image 2', () => {
    expect(gptImage2Schema.size).toMatchObject({
      allowCustom: true,
      max: 4096,
      min: 256,
      step: 64,
    });
  });
});
