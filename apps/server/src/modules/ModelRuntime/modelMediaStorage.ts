import { createHash } from 'node:crypto';

import { pickString, toRecord } from '@lobechat/utils/object';

import { FileS3 } from '@/server/modules/S3';

import { compressModelImage } from './compressImage';

export interface ModelMediaFile {
  fileHash?: string | null;
  fileType: string;
  id: string;
  updatedAt: Date | number | string;
  url: string;
}

export interface ModelMediaReference {
  expiresAt: number;
  value: string;
}

export interface ModelMediaStore {
  createPreSignedUrlForPreview: (key: string, expiresIn?: number) => Promise<string>;
  getFileByteArray: (key: string) => Promise<Uint8Array>;
  getFileMetadata: (key: string) => Promise<{ contentLength: number; contentType?: string }>;
  uploadPrivateBuffer: (key: string, buffer: Buffer, mimeType: string) => Promise<unknown>;
}

const URL_TTL_SECONDS = 3600;
const URL_SAFETY_MS = 60_000;
const availability = new Map<string, { expiresAt: number; value: Promise<boolean> }>();

const extension = (mimeType: string) =>
  mimeType === 'image/webp' ? 'webp' : mimeType === 'image/jpeg' ? 'jpg' : 'png';

const missingObject = (error: unknown) => {
  const record = toRecord(error);
  return (
    toRecord(record?.$metadata)?.httpStatusCode === 404 ||
    ['NotFound', 'NoSuchKey'].includes(pickString(record?.name) ?? '')
  );
};

/** Private, immutable transmission copies; original files and message content stay unchanged. */
export class ModelMediaStorage {
  private readonly proxy: URL;

  constructor(
    proxyUrl: string,
    private readonly storage: ModelMediaStore = new FileS3(),
  ) {
    this.proxy = new URL(proxyUrl);
    if (
      this.proxy.protocol !== 'https:' ||
      this.proxy.username ||
      this.proxy.password ||
      this.proxy.search ||
      this.proxy.hash
    )
      throw new Error('Model media proxy must be a configured HTTPS endpoint without credentials');
  }

  async resolve(
    file: ModelMediaFile,
    userId: string,
    workspaceId?: string,
  ): Promise<ModelMediaReference> {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.fileType))
      throw new Error('This image format keeps its original inline transmission');
    const digest = createHash('sha256')
      .update(
        JSON.stringify([
          'model-media:webp88:effort2:v1',
          userId,
          workspaceId ?? '',
          file.id,
          file.fileHash ?? file.url,
          file.updatedAt,
          file.fileType,
        ]),
      )
      .digest('hex');
    const prefix = `model-media/v1/${digest}`;
    let key: string | undefined;
    for (const suffix of new Set(['webp', extension(file.fileType)])) {
      const candidate = `${prefix}.${suffix}`;
      try {
        const metadata = await this.storage.getFileMetadata(candidate);
        if (
          metadata.contentLength > 0 &&
          ['image/png', 'image/jpeg', 'image/webp'].includes(metadata.contentType ?? '')
        ) {
          key = candidate;
          break;
        }
      } catch (error) {
        if (!missingObject(error)) throw error;
      }
    }
    if (!key) {
      const bytes = await this.storage.getFileByteArray(file.url);
      const image = await compressModelImage(bytes, file.fileType);
      key = `${prefix}.${extension(image.mimeType)}`;
      await this.storage.uploadPrivateBuffer(key, Buffer.from(image.bytes), image.mimeType);
    }
    const signed = new URL(await this.storage.createPreSignedUrlForPreview(key, URL_TTL_SECONDS));
    const date = signed.searchParams.get('X-Amz-Date');
    const seconds = Number(signed.searchParams.get('X-Amz-Expires'));
    const signature = signed.searchParams.get('X-Amz-Signature');
    if (
      !date ||
      !/^\d{8}T\d{6}Z$/.test(date) ||
      !Number.isFinite(seconds) ||
      seconds <= 0 ||
      seconds > URL_TTL_SECONDS ||
      !signature ||
      !/^[0-9a-f]{64}$/.test(signature) ||
      signed.searchParams.get('X-Amz-SignedHeaders') !== 'host'
    )
      throw new Error('Model media download signature expiration is missing');
    const started = Date.parse(
      `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}Z`,
    );
    const expiresAt = started + Math.min(seconds, URL_TTL_SECONDS) * 1000 - URL_SAFETY_MS;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now())
      throw new Error('Model media download signature has expired');
    const rewritten = new URL(this.proxy);
    rewritten.pathname = this.proxy.pathname.replace(/\/$/, '') + signed.pathname;
    rewritten.search = signed.search;
    return { expiresAt, value: rewritten.href };
  }

  async isReachable(reference: ModelMediaReference): Promise<boolean> {
    const now = Date.now();
    if (reference.expiresAt <= now) return false;
    const cache = availability.get(this.proxy.href);
    if (cache && cache.expiresAt > now) return cache.value;
    const value = (async () => {
      let response: Response | undefined;
      try {
        // The preview signature authorizes GET, so HEAD would fail SigV4 validation.
        response = await fetch(reference.value, {
          headers: { Range: 'bytes=0-0' },
          method: 'GET',
          redirect: 'error',
          signal: AbortSignal.timeout(5000),
        });
        return (
          [200, 206].includes(response.status) &&
          response.headers.get('content-type')?.startsWith('image/') === true
        );
      } catch (error) {
        console.error('[ModelMedia] Public preflight unavailable:', (error as Error).name);
        return false;
      } finally {
        // A proxy can ignore Range; release the stream without downloading the whole image.
        if (response?.body) {
          try {
            await response.body.cancel();
          } catch (error) {
            console.error('[ModelMedia] Public preflight cleanup failed:', (error as Error).name);
          }
        }
      }
    })();
    availability.set(this.proxy.href, {
      expiresAt: Math.min(now + 30_000, reference.expiresAt),
      value,
    });
    if (availability.size > 20) availability.delete(availability.keys().next().value!);
    return value;
  }
}
