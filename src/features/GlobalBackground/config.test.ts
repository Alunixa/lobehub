import { describe, expect, it } from 'vitest';

import { normalizeBackgroundConfig, validateBackgroundFile } from './config';
import { getBackgroundCrop } from './crop';

const image = { id: 'file_1', name: 'snow.webp', url: '/f/file_1' };

describe('global background configuration', () => {
  it('is disabled for existing accounts with no background settings', () => {
    expect(normalizeBackgroundConfig()).toMatchObject({ enabled: false, images: [] });
    expect(normalizeBackgroundConfig(null)).toMatchObject({ enabled: false, images: [] });
  });

  it('rejects arbitrary URLs, temporary credentials and invalid file routes', () => {
    const config = normalizeBackgroundConfig({
      images: [
        image,
        { id: 'evil', url: 'https://example.com/tracker' },
        { id: '../secret', url: '/f/../secret' },
        { id: 'other', url: '/f/other?token=private' },
        { id: 'script', url: 'javascript:alert(1)' },
        image,
      ],
    });
    expect(config.images).toEqual([image]);
    expect(config.activeImageId).toBe(image.id);
  });

  it('caps image count and clamps imported numeric settings', () => {
    const config = normalizeBackgroundConfig({
      blur: 1000,
      images: Array.from({ length: 20 }, (_, i) => ({
        id: `file_${i}`,
        url: `/f/file_${i}`,
      })),
      intervalSeconds: 1,
      opacity: -1,
      overlayColor: 'red',
      overlayOpacity: NaN,
    });
    expect(config.images).toHaveLength(8);
    expect(config).toMatchObject({
      blur: 30,
      intervalSeconds: 10,
      opacity: 0,
      overlayColor: 'auto',
      overlayOpacity: 0.35,
    });
  });

  it('preserves desktop and mobile configurations independently', () => {
    const desktop = normalizeBackgroundConfig({ enabled: true, images: [image], blur: 12 });
    const mobile = normalizeBackgroundConfig({ enabled: false, images: [], blur: 0 });
    expect(desktop.enabled).toBe(true);
    expect(mobile).toMatchObject({ enabled: false, images: [], blur: 0 });
    expect(desktop.images).toHaveLength(1);
  });

  it.each(['image/svg+xml', 'text/html', 'image/gif'])('rejects unsupported upload %s', (type) => {
    expect(validateBackgroundFile({ type, size: 100 })).toBe('type');
  });

  it('rejects empty or oversized files but accepts supported raster images', () => {
    expect(validateBackgroundFile({ type: 'image/png', size: 0 })).toBe('size');
    expect(validateBackgroundFile({ type: 'image/png', size: 21 * 1024 * 1024 })).toBe('size');
    expect(validateBackgroundFile({ type: 'image/webp', size: 200 })).toBeUndefined();
  });
});

describe('background crop geometry', () => {
  it('crops a landscape image into a centered portrait without stretching', () => {
    const crop = getBackgroundCrop(1920, 1080, { aspect: 9 / 16, x: 50, y: 50, zoom: 1 });
    expect(crop.width / crop.height).toBeCloseTo(9 / 16);
    expect(crop.left).toBeCloseTo((1920 - 607.5) / 2);
    expect(crop.top).toBe(0);
  });

  it('bounds crop movement and zoom within the original image', () => {
    const crop = getBackgroundCrop(1000, 800, { aspect: 1, x: 200, y: -100, zoom: 2 });
    expect(crop).toMatchObject({ height: 400, left: 600, top: 0, width: 400 });
    expect(crop.left + crop.width).toBeLessThanOrEqual(1000);
  });

  it('limits output resolution for mobile GPU and memory use', () => {
    const crop = getBackgroundCrop(8000, 4500, { aspect: 16 / 9, x: 50, y: 50, zoom: 1 });
    expect(crop.outputWidth).toBe(2560);
    expect(crop.outputHeight).toBe(1440);
  });

  it('rejects invalid image dimensions instead of exporting a corrupt crop', () => {
    expect(() => getBackgroundCrop(0, 100, { aspect: 1, x: 50, y: 50, zoom: 1 })).toThrow();
  });
});
