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
  it('probes a GET signature with a one-byte range and reuses its successful availability', async () => {
    const fetcher = vi.fn(async (_input: string, init?: RequestInit) =>
      init?.method === 'GET'
        ? new Response(new Uint8Array([1]), {
            headers: { 'content-type': 'image/webp', 'content-range': 'bytes 0-0/500' },
            status: 206,
          })
        : new Response(null, { status: 403 }),
    );
    vi.stubGlobal('fetch', fetcher);
    const service = new ModelMediaStorage('https://media.example/reachable-test', createStore());
    const reference = {
      value: signed('cached.webp'),
      expiresAt: Date.now() + 3600000,
    };
    expect(await service.isReachable(reference)).toBe(true);
    expect(await service.isReachable(reference)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      reference.value,
      expect.objectContaining({
        headers: { Range: 'bytes=0-0' },
        method: 'GET',
        redirect: 'error',
      }),
    );
  });
  it('cancels the response body if the proxy ignores the requested range', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    const fetcher = vi.fn(
      async () => new Response(body, { headers: { 'content-type': 'image/png' } }),
    );
    vi.stubGlobal('fetch', fetcher);
    const service = new ModelMediaStorage('https://media.example/ignored-range', createStore());
    expect(
      await service.isReachable({ value: signed('large.png'), expiresAt: Date.now() + 60_000 }),
    ).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it.each([
    { status: 403, mime: 'application/xml' },
    { status: 200, mime: 'text/html' },
    { status: 204, mime: 'image/webp' },
  ])('does not treat $status $mime as an available image', async ({ status, mime }) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { headers: { 'content-type': mime }, status })),
    );
    const service = new ModelMediaStorage(
      `https://media.example/unavailable-${status}`,
      createStore(),
    );
    expect(
      await service.isReachable({ value: signed('cached.webp'), expiresAt: Date.now() + 60_000 }),
    ).toBe(false);
  });
  it('rejects an expired reference even when the endpoint was just reachable', async () => {
    const fetcher = vi.fn(
      async () => new Response(null, { headers: { 'content-type': 'image/webp' } }),
    );
    vi.stubGlobal('fetch', fetcher);
    const service = new ModelMediaStorage('https://media.example/expired-test', createStore());
    const reference = { value: signed('cached.webp'), expiresAt: Date.now() + 1000 };
    expect(await service.isReachable(reference)).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(await service.isReachable(reference)).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
