// @vitest-environment node
import type { Server } from 'node:http';
import { createServer } from 'node:http';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { formatErrorForState } from './formatErrorForState';
import { createLlmRequestTiming } from './llmRequestTiming';

describe('per-attempt LLM request timing', () => {
  let server: Server;
  let origin: string;

  beforeAll(async () => {
    server = createServer((request, response) => {
      request.resume();
      request.once('end', () => {
        if (request.headers['x-fixture-close'] === 'true') {
          request.socket.destroy();
          return;
        }
        setTimeout(() => {
          response.writeHead(200, { 'content-type': 'text/plain' });
          response.write('first response bytes');
          setTimeout(() => response.end('\ncomplete'), 8);
        }, 8);
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing HTTP fixture address');
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('captures real body bytes, headers and completion without retaining request data', async () => {
    const timing = createLlmRequestTiming();
    const body = JSON.stringify({ input: '中文 fixture', privateData: 'private-fixture' });
    try {
      const response = await timing.run(() =>
        fetch(`${origin}/v1/responses`, {
          body,
          headers: { authorization: 'Bearer private-fixture' },
          method: 'POST',
        }),
      );
      // Reading may happen outside the async-local scope after the SDK returns.
      expect(await response.text()).toContain('complete');
      const snapshot = timing.snapshot()!;
      expect(snapshot).toMatchObject({
        httpStatus: 200,
        phase: 'completed',
        requestBodyBytes: Buffer.byteLength(body),
        requestCount: 1,
      });
      expect(snapshot.requestBodySentMs).toBeGreaterThanOrEqual(snapshot.requestCreatedMs);
      expect(snapshot.responseHeadersMs).toBeGreaterThanOrEqual(snapshot.requestBodySentMs!);
      expect(snapshot.responseEndedMs).toBeGreaterThanOrEqual(snapshot.responseHeadersMs!);
      expect(JSON.stringify(snapshot)).not.toContain('private-fixture');
      expect(JSON.stringify(snapshot)).not.toContain(origin);
    } finally {
      timing.dispose();
    }
  });

  it('isolates concurrent model requests', async () => {
    const captures = [createLlmRequestTiming(), createLlmRequestTiming()];
    const bodies = ['x'.repeat(128), 'y'.repeat(257)];
    try {
      await Promise.all(
        captures.map(async (timing, index) => {
          const response = await timing.run(() =>
            fetch(`${origin}/v1/chat/completions`, { body: bodies[index], method: 'POST' }),
          );
          await response.text();
        }),
      );
      for (const [index, timing] of captures.entries()) {
        expect(timing.snapshot()).toMatchObject({
          phase: 'completed',
          requestBodyBytes: bodies[index].length,
          requestCount: 1,
        });
      }
    } finally {
      for (const timing of captures) timing.dispose();
    }
  });

  it('wraps a bound SDK method without changing its arguments or receiver', async () => {
    const timing = createLlmRequestTiming();
    const sdk = {
      origin,
      async chat(body: string, options: { method: string }) {
        return fetch(`${this.origin}/v1/responses`, { body, ...options });
      },
    };
    try {
      const chat = timing.bind(sdk.chat.bind(sdk));
      const response = await chat('bound fixture', { method: 'POST' });
      await response.text();
      expect(timing.snapshot()).toMatchObject({
        phase: 'completed',
        requestBodyBytes: 'bound fixture'.length,
        requestCount: 1,
      });
    } finally {
      timing.dispose();
    }
  });

  it('captures connection closure before headers and persists the exact failure phase', async () => {
    const timing = createLlmRequestTiming();
    try {
      await expect(
        timing.run(() =>
          fetch(`${origin}/v1/responses`, {
            body: '{"input":"local fixture"}',
            headers: { 'x-fixture-close': 'true' },
            method: 'POST',
          }),
        ),
      ).rejects.toThrow('fetch failed');
      expect(timing.snapshot()).toMatchObject({
        phase: 'awaiting_headers',
        requestCount: 1,
        transportErrorCode: 'UND_ERR_SOCKET',
      });
      expect(timing.snapshot()?.responseHeadersMs).toBeUndefined();
      const error = timing.enrichError({
        error: { cause: { code: 'UND_ERR_SOCKET' } },
        errorType: 'ProviderBizError',
        message: 'Connection error.',
        provider: 'custom-fixture',
      });
      const serialized = JSON.stringify(formatErrorForState(error));
      expect(JSON.parse(serialized).body).toMatchObject({
        cause: { code: 'UND_ERR_SOCKET' },
        requestTiming: { phase: 'awaiting_headers', transportErrorCode: 'UND_ERR_SOCKET' },
      });
    } finally {
      timing.dispose();
    }
  });

  it('ignores unrelated requests even when they happen during model preparation', async () => {
    const timing = createLlmRequestTiming();
    try {
      await timing.run(async () => {
        await (await fetch(`${origin}/uploads`, { body: 'fixture', method: 'POST' })).text();
        await (await fetch(`${origin}/v1/responses`)).text();
      });
      await (
        await fetch(`${origin}/v1/responses`, { body: 'outside scope', method: 'POST' })
      ).text();
      expect(timing.snapshot()).toBeUndefined();
      expect(timing.enrichError('fixture')).toBe('fixture');
    } finally {
      timing.dispose();
    }
  });

  it('does not observe later requests after disposal', async () => {
    const timing = createLlmRequestTiming();
    timing.dispose();
    await timing.run(async () => {
      await (await fetch(`${origin}/v1/responses`, { body: 'fixture', method: 'POST' })).text();
    });
    expect(timing.snapshot()).toBeUndefined();
  });

  it('reports multiple SDK requests rather than silently hiding retries', async () => {
    const timing = createLlmRequestTiming();
    try {
      await timing.run(async () => {
        for (let index = 0; index < 2; index++) {
          await (await fetch(`${origin}/v1/responses`, { body: 'fixture', method: 'POST' })).text();
        }
      });
      expect(timing.snapshot()?.requestCount).toBe(2);
    } finally {
      timing.dispose();
    }
  });

  it('keeps structured stream bodies and Error identity when enriching a failure', async () => {
    const timing = createLlmRequestTiming();
    try {
      await timing.run(async () => {
        await (await fetch(`${origin}/v1/responses`, { body: 'fixture', method: 'POST' })).text();
      });
      const error = Object.assign(new Error('stream error'), {
        _responseBody: { error: { message: 'stream error' }, responseId: 'fixture-response' },
        errorType: 'ProviderBizError',
      });
      expect(timing.enrichError(error)).toBe(error);
      const formatted = formatErrorForState(error);
      expect(formatted.body).toMatchObject({
        error: { message: 'stream error' },
        requestTiming: { phase: 'completed', requestCount: 1 },
        responseId: 'fixture-response',
      });
      const frozen = Object.freeze(new Error('frozen'));
      expect(timing.enrichError(frozen)).toBe(frozen);
      expect(timing.enrichError({ error: 'original provider error' })).toMatchObject({
        error: {
          error: 'original provider error',
          requestTiming: { phase: 'completed', requestCount: 1 },
        },
      });
      const textBodyError = Object.assign(new Error('plain stream error'), {
        _responseBody: 'original stream error',
        errorType: 'ProviderBizError',
      });
      expect(timing.enrichError(textBodyError)).toBe(textBodyError);
      expect(formatErrorForState(textBodyError).body).toMatchObject({
        error: 'original stream error',
        requestTiming: { phase: 'completed', requestCount: 1 },
      });
    } finally {
      timing.dispose();
    }
  });
});
