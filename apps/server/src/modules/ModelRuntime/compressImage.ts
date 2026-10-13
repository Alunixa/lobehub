/** Re-encode a model-only copy. Keep dimensions, transparency and the original attachment. */
export const compressModelImage = async (
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> => {
  const original = { bytes, mimeType };
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) return original;
  try {
    const { default: sharp } = await import('sharp');
    const image = sharp(bytes, { limitInputPixels: 100_000_000 });
    const metadata = await image.metadata();
    if ((metadata.pages ?? 1) > 1) return original;
    const compressed = await image.rotate().webp({ effort: 2, quality: 88 }).toBuffer();
    return compressed.length < bytes.length
      ? { bytes: compressed, mimeType: 'image/webp' }
      : original;
  } catch (error) {
    console.error('[ModelImageCompression] Original image retained:', (error as Error).name);
    return original;
  }
};
