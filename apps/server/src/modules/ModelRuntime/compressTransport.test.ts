// @vitest-environment node
import { gunzipSync } from 'node:zlib';

import { describe, expect, it, vi } from 'vitest';

import { createCompressedFetch } from './compressTransport';

describe('opt-in lossless JSON transport compression', () => {
  it('keeps complete file content and invokes the upstream only once', async () => {
    const body = JSON.stringify({ input: '原文件全部内容，不删段落。\n'.repeat(2000) });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    await createCompressedFetch(fetcher)('https://fixture.invalid/v1/responses', {
      body,
      headers: { 'content-type': 'application/json', 'content-length': String(body.length) },
      method: 'POST',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const init = fetcher.mock.calls[0][1]!;
    expect(new Headers(init.headers).get('content-encoding')).toBe('gzip');
    expect(new Headers(init.headers).has('content-length')).toBe(false);
    expect(gunzipSync(init.body as Uint8Array).toString()).toBe(body);
    expect((init.body as Uint8Array).length).toBeLessThan(Buffer.byteLength(body) / 10);
  });
  it('does not reissue a rejected compressed model request', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('unsupported', { status: 415 }));
    const response = await createCompressedFetch(fetcher)('https://fixture.invalid', {
      body: JSON.stringify({ input: 'large input '.repeat(1000) }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(response.status).toBe(415);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('preserves non-JSON and tiny requests', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    const init = { body: 'tiny input', headers: { 'content-type': 'text/plain' }, method: 'POST' };
    await createCompressedFetch(fetcher)('https://fixture.invalid', init);
    expect(fetcher.mock.calls[0][1]).toBe(init);
  });
  it('respects an aborted operation before sending', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const signal = AbortSignal.abort();
    await expect(
      createCompressedFetch(fetcher)('https://fixture.invalid', {
        body: 'x'.repeat(5000),
        headers: { 'content-type': 'application/json' },
        signal,
      }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
