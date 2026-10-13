import { promisify } from 'node:util';
import { gzip } from 'node:zlib';

const gzipAsync = promisify(gzip);
const MIN_GZIP_BYTES = 1024;

/** Explicit opt-in only. Unsupported providers fail normally; never replay a paid request. */
export const createCompressedFetch =
  (fetcher: typeof fetch = globalThis.fetch): typeof fetch =>
  async (input, init) => {
    if (typeof init?.body !== 'string') return fetcher(input, init);
    const headers = new Headers(init.headers);
    if (
      headers.has('content-encoding') ||
      !headers.get('content-type')?.includes('application/json')
    )
      return fetcher(input, init);

    const bytes = Buffer.from(init.body);
    if (bytes.length < MIN_GZIP_BYTES) return fetcher(input, init);
    init.signal?.throwIfAborted();
    const compressed = await gzipAsync(bytes);
    init.signal?.throwIfAborted();
    if (compressed.length >= bytes.length) return fetcher(input, init);
    headers.set('content-encoding', 'gzip');
    headers.delete('content-length');
    return fetcher(input, { ...init, body: new Uint8Array(compressed), headers });
  };
