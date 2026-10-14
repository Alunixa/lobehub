// @vitest-environment node
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ModelMediaFile, ModelMediaStore } from './modelMediaStorage';
import { ModelMediaStorage } from './modelMediaStorage';

const file: ModelMediaFile = {
  fileHash: 'immutable',
  fileType: 'image/png',
  id: 'file_owned',
  updatedAt: '2026-10-15T00:00:00.000Z',
  url: 'uploads/original.png',
};
const signed = (key: string, date = '20261015T000000Z') =>
  `https://private-storage.example/bucket/${key}?X-Amz-Date=${date}&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=${'a'.repeat(64)}`;
const createStore = (): ModelMediaStore => ({
  createPreSignedUrlForPreview: vi.fn(async (key) => signed(key)),
  getFileByteArray: vi.fn(),
  getFileMetadata: vi.fn(async () => ({ contentLength: 500, contentType: 'image/webp' })),
  uploadPrivateBuffer: vi.fn(),
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-15T00:05:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('private model transmission storage', () => {
  it('reuses an immutable derivative and rewrites only the public endpoint', async () => {
    const store = createStore();
    const media = await new ModelMediaStorage('https://media.example/objects', store).resolve(
      file,
      'user',
      'workspace',
    );
    const value = new URL(media.value);
    expect(value.origin).toBe('https://media.example');
    expect(value.pathname).toMatch(/^\/objects\/bucket\/model-media\/v1\/[a-f0-9]{64}\.webp$/);
    expect(value.searchParams.get('X-Amz-Signature')).toBe('a'.repeat(64));
    expect(media.expiresAt).toBe(Date.parse('2026-10-15T00:59:00Z'));
    expect(store.getFileByteArray).not.toHaveBeenCalled();
    expect(store.uploadPrivateBuffer).not.toHaveBeenCalled();
  });
  it('creates a smaller same-dimension private copy once without modifying the original', async () => {
    vi.useRealTimers();
    const original = await sharp({
      create: {
        width: 1200,
        height: 900,
        channels: 4,
        background: { r: 30, g: 80, b: 100, alpha: 0.6 },
      },
    })
      .png()
      .toBuffer();
    const snapshot = Buffer.from(original);
    const store = createStore();
    vi.mocked(store.getFileMetadata).mockRejectedValue({
      name: 'NotFound',
      $metadata: { httpStatusCode: 404 },
    });
    vi.mocked(store.getFileByteArray).mockResolvedValue(original);
    vi.mocked(store.createPreSignedUrlForPreview).mockImplementation(async (key) =>
      signed(key, new Date().toISOString().replaceAll(/[-:]/g, '').slice(0, 15) + 'Z'),
    );
    const media = await new ModelMediaStorage('https://media.example/objects', store).resolve(
      file,
      'user',
    );
    expect(media.value).toContain('/objects/bucket/model-media/v1/');
    const [, uploaded, mime] = vi.mocked(store.uploadPrivateBuffer).mock.calls[0];
    const metadata = await sharp(uploaded).metadata();
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(900);
    expect(metadata.hasAlpha).toBe(true);
    expect(mime).toBe('image/webp');
    expect(uploaded.length).toBeLessThan(original.length);
    expect(original.equals(snapshot)).toBe(true);
  });
  it('keeps users, workspaces and changed file versions in different objects', async () => {
    const store = createStore();
    const service = new ModelMediaStorage('https://media.example/scope', store);
    const values = await Promise.all([
      service.resolve(file, 'first', 'one'),
      service.resolve(file, 'second', 'one'),
      service.resolve(file, 'first', 'two'),
      service.resolve({ ...file, updatedAt: '2026-10-15T00:01:00Z' }, 'first', 'one'),
    ]);
    expect(new Set(values.map((value) => new URL(value.value).pathname)).size).toBe(4);
  });
  it('does not confuse an access or network failure with a missing derivative', async () => {
    const store = createStore();
    vi.mocked(store.getFileMetadata).mockRejectedValue(new Error('access denied'));
    await expect(
      new ModelMediaStorage('https://media.example/a', store).resolve(file, 'user'),
    ).rejects.toThrow('access denied');
    expect(store.uploadPrivateBuffer).not.toHaveBeenCalled();
  });
  it('rejects expired or unsigned references instead of extending their validity', async () => {
    const store = createStore();
    vi.mocked(store.createPreSignedUrlForPreview).mockResolvedValueOnce(
      signed('cached.webp', '20261014T000000Z'),
    );
    const service = new ModelMediaStorage('https://media.example/a', store);
    await expect(service.resolve(file, 'user')).rejects.toThrow('expired');
    vi.mocked(store.createPreSignedUrlForPreview).mockResolvedValueOnce(
      'https://storage.example/cached.webp',
    );
    await expect(service.resolve(file, 'user')).rejects.toThrow('expiration');
  });
  it.each([
    'http://media.example/a',
    'https://user:password@media.example/a',
    'https://media.example/a?secret=yes',
  ])('rejects an unsuitable configured proxy %s', (url) =>
    expect(() => new ModelMediaStorage(url, createStore())).toThrow('configured HTTPS'),
  );
  it('performs one short public HEAD preflight and never retries a model request', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { headers: { 'content-type': 'image/webp' } }));
    vi.stubGlobal('fetch', fetcher);
    const service = new ModelMediaStorage('https://media.example/reachable-test', createStore());
    const reference = {
      value: 'https://media.example/reachable-test/signed',
      expiresAt: Date.now() + 3600000,
    };
    expect(await service.isReachable(reference)).toBe(true);
    expect(await service.isReachable(reference)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      reference.value,
      expect.objectContaining({ method: 'HEAD', redirect: 'error' }),
    );
  });
});
