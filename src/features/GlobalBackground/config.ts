import type { BackgroundConfig, BackgroundImage } from '@lobechat/types';
import { isPlainRecord } from '@lobechat/utils/object';

export const MAX_BACKGROUND_IMAGES = 8;
export const MAX_BACKGROUND_FILE_BYTES = 20 * 1024 * 1024;
export const BACKGROUND_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export const DEFAULT_BACKGROUND_CONFIG: BackgroundConfig = {
  blur: 0,
  enabled: false,
  images: [],
  intervalSeconds: 60,
  opacity: 1,
  overlayColor: 'auto',
  overlayOpacity: 0.35,
  slideshow: true,
};

const finite = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

export const normalizeBackgroundConfig = (value?: unknown): BackgroundConfig => {
  const config = isPlainRecord(value) ? value : {};
  const seen = new Set<string>();
  const images: BackgroundImage[] = [];
  for (const image of Array.isArray(config.images) ? config.images : []) {
    if (
      !isPlainRecord(image) ||
      typeof image.id !== 'string' ||
      !/^[\w-]{1,128}$/.test(image.id) ||
      image.url !== `/f/${image.id}` ||
      seen.has(image.id)
    )
      continue;
    seen.add(image.id);
    images.push({
      id: image.id,
      name: typeof image.name === 'string' ? image.name.slice(0, 200) : 'Background',
      url: `/f/${image.id}`,
    });
    if (images.length === MAX_BACKGROUND_IMAGES) break;
  }
  return {
    activeImageId:
      typeof config.activeImageId === 'string' && seen.has(config.activeImageId)
        ? config.activeImageId
        : images[0]?.id,
    blur: finite(config.blur, 0, 0, 30),
    enabled: config.enabled === true,
    images,
    intervalSeconds: finite(config.intervalSeconds, 60, 10, 3600),
    opacity: finite(config.opacity, 1, 0, 1),
    overlayColor:
      config.overlayColor === 'black' || config.overlayColor === 'white'
        ? config.overlayColor
        : 'auto',
    overlayOpacity: finite(config.overlayOpacity, 0.35, 0, 1),
    slideshow: config.slideshow !== false,
  };
};

export const validateBackgroundFile = (file: Pick<File, 'size' | 'type'>) => {
  if (!BACKGROUND_IMAGE_TYPES.includes(file.type)) return 'type' as const;
  if (file.size > MAX_BACKGROUND_FILE_BYTES || file.size === 0) return 'size' as const;
};
