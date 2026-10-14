import type { ModelRuntimeHooks } from '@lobechat/model-runtime';
import { isRecord } from '@lobechat/utils/object';

import { FileModel } from '@/database/models/file';
import type { LobeChatDatabase } from '@/database/type';
import { appEnv } from '@/envs/app';
import { FileService } from '@/server/services/file';

import { compressModelImage } from './compressImage';

const MAX_CACHE_BYTES = 64 * 1024 * 1024;
const CACHE_TTL_MS = 30 * 60 * 1000;
const images = new Map<string, { expiresAt: number; value: string }>();
const pendingImages = new Map<string, Promise<string>>();
let cacheBytes = 0;

/** Resolve only our own authenticated file IDs; external URLs retain SSRF-safe fetching. */
export const createOwnedMediaHook = (
  db: LobeChatDatabase,
  userId: string,
  workspaceId?: string,
  compressImages = false,
): ModelRuntimeHooks => ({
  beforeChat: async (payload) => {
    const fileUrls = new Map<string, string>();
    for (const message of payload.messages) {
      if (!Array.isArray(message.content)) continue;
      for (const part of message.content) {
        const media =
          part.type === 'image_url'
            ? part.image_url
            : part.type === 'video_url'
              ? part.video_url
              : part.type === 'audio_url'
                ? part.audio_url
                : undefined;
        if (!media) continue;
        try {
          const url = new URL(media.url);
          if (url.origin !== new URL(appEnv.APP_URL).origin) continue;
          const match = /^\/f\/(file_[\w-]+)$/.exec(url.pathname);
          if (match) fileUrls.set(media.url, match[1]);
        } catch {
          // Data URIs and external URL validation are handled by the provider.
        }
      }
    }
    if (fileUrls.size === 0) return;

    // Reauthorize on every request, including cache hits. A file deleted or moved
    // out of this workspace must never be recoverable from the process cache.
    const files = await new FileModel(db, userId, workspaceId).findByIds([
      ...new Set(fileUrls.values()),
    ]);
    const records = new Map(files.map((file) => [file.id, file]));
    const service = new FileService(db, userId, workspaceId);
    const resolved = new Map<string, string>();
    const entries = [...fileUrls];
    for (let offset = 0; offset < entries.length; offset += 4) {
      await Promise.all(
        entries.slice(offset, offset + 4).map(async ([url, id]) => {
          const file = records.get(id);
          if (!file?.url || !/^(?:image|video|audio)\//.test(file.fileType ?? '')) {
            throw new Error('Media attachment not found or inaccessible');
          }
          const key = `${userId}:${workspaceId ?? ''}:${id}:${file.fileHash ?? file.url}:${file.updatedAt}:${compressImages ? 'webp88' : 'original'}`;
          const cached = images.get(key);
          if (cached && cached.expiresAt > Date.now()) {
            images.delete(key);
            cached.expiresAt = Date.now() + CACHE_TTL_MS;
            images.set(key, cached);
            resolved.set(url, cached.value);
            return;
          }
          if (cached) {
            images.delete(key);
            cacheBytes -= cached.value.length;
          }
          let loading = pendingImages.get(key);
          if (!loading) {
            loading = (async () => {
              // No HTTP request to /f and no forwarded browser credentials.
              const bytes = await service.getFileByteArray(file.url);
              const media =
                compressImages && file.fileType.startsWith('image/')
                  ? await compressModelImage(bytes, file.fileType)
                  : { bytes, mimeType: file.fileType };
              return `data:${media.mimeType};base64,${Buffer.from(media.bytes).toString('base64')}`;
            })();
            pendingImages.set(key, loading);
          }
          let value: string;
          try {
            value = await loading;
          } finally {
            if (pendingImages.get(key) === loading) pendingImages.delete(key);
          }
          const concurrent = images.get(key);
          if (concurrent) {
            images.delete(key);
            cacheBytes -= concurrent.value.length;
          }
          while (cacheBytes + value.length > MAX_CACHE_BYTES && images.size > 0) {
            const oldest = images.keys().next().value!;
            cacheBytes -= images.get(oldest)!.value.length;
            images.delete(oldest);
          }
          if (value.length <= MAX_CACHE_BYTES) {
            images.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
            cacheBytes += value.length;
          }
          resolved.set(url, value);
        }),
      );
    }

    payload.messages = payload.messages.map((message) => {
      if (!Array.isArray(message.content)) return message;
      return {
        ...message,
        content: message.content.map((part) => {
          const key =
            part.type === 'image_url' || part.type === 'video_url' || part.type === 'audio_url'
              ? part.type
              : undefined;
          if (!key) return part;
          const media =
            part.type === 'image_url'
              ? part.image_url
              : part.type === 'video_url'
                ? part.video_url
                : part.type === 'audio_url'
                  ? part.audio_url
                  : undefined;
          if (!media || !isRecord(media)) return part;
          const value = resolved.get(media.url);
          return value ? { ...part, [key]: { ...media, url: value } } : part;
        }),
      };
    });
  },
});
