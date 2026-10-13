// @vitest-environment node
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { compressModelImage } from './compressImage';

describe('model-bound image copies', () => {
  it('reduces a large raster without changing dimensions, alpha or original bytes', async () => {
    const original = await sharp({
      create: {
        width: 1200,
        height: 900,
        channels: 4,
        background: { r: 38, g: 123, b: 155, alpha: 0.6 },
      },
    })
      .png()
      .toBuffer();
    const snapshot = Buffer.from(original);
    const result = await compressModelImage(original, 'image/png');
    const metadata = await sharp(result.bytes).metadata();
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(900);
    expect(metadata.hasAlpha).toBe(true);
    expect(result.bytes.length).toBeLessThan(original.length);
    expect(original.equals(snapshot)).toBe(true);
    expect(result.mimeType).toBe('image/webp');
  });
  it.each(['image/svg+xml', 'image/gif', 'application/pdf'])(
    'preserves originals for %s',
    async (mime) => {
      const bytes = new Uint8Array([1, 2, 3]);
      const result = await compressModelImage(bytes, mime);
      expect(result.bytes).toBe(bytes);
      expect(result.mimeType).toBe(mime);
    },
  );
});
