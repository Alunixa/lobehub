import { Buffer } from 'buffer.js';

/** Videos use the original Blob for playback; don't Base64-encode them in the UI. */
export const createChatUploadPreview = async (
  file: File,
): Promise<{
  base64Url?: string;
  previewUrl?: string;
}> => {
  if (file.type.startsWith('video/')) return { previewUrl: URL.createObjectURL(file) };
  if (!file.type.startsWith('image/')) return {};
  const data = await file.arrayBuffer();
  return {
    base64Url: `data:${file.type};base64,${Buffer.from(data).toString('base64')}`,
    previewUrl: URL.createObjectURL(new Blob([data], { type: file.type })),
  };
};
