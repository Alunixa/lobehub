// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LobeGoogleAI } from './index';

afterEach(() => vi.restoreAllMocks());

describe('Google protocol transport', () => {
  it('preserves later system metadata instead of keeping only the first system message', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          'data: {"candidates":[{"content":{"parts":[{"text":"answer"}],"role":"model"},"finishReason":"STOP"}]}\n\n',
          { headers: { 'content-type': 'text/event-stream' } },
        ),
      );
    const runtime = new LobeGoogleAI({ apiKey: 'test', maxRetries: 0 });
    const response = await runtime.chat({
      messages: [
        { content: 'original instructions', role: 'system' },
        { content: 'hello', role: 'user' },
        { content: 'latest timing and model metadata', role: 'system' },
      ],
      model: 'gemini-test',
    });
    await response.text();
    const payload = JSON.parse(fetcher.mock.calls[0][1]?.body as string);
    expect(payload.systemInstruction.parts[0].text).toBe(
      'original instructions\n\nlatest timing and model metadata',
    );
    expect(payload.contents).toHaveLength(1);
  });
  it.each(['/v1', '/v1/', '/v1beta', ''])(
    'normalizes a retained %s endpoint and preserves custom headers',
    async (suffix) => {
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(
          new Response(
            'data: {"candidates":[{"content":{"parts":[{"text":"native answer"}],"role":"model"},"finishReason":"STOP"}]}\n\n',
            { headers: { 'content-type': 'text/event-stream' } },
          ),
        );
      const runtime = new LobeGoogleAI({
        apiKey: 'test',
        baseURL: `https://provider.example/gateway${suffix}`,
        defaultHeaders: { 'x-custom': 'preserved' },
        maxRetries: 0,
      });
      const response = await runtime.chat({
        messages: [{ content: 'test', role: 'user' }],
        model: 'gemini-test',
      });
      expect(await response.text()).toContain('native answer');
      expect(fetcher).toHaveBeenCalledTimes(1);
      const [url, init] = fetcher.mock.calls[0];
      expect(String(url)).toBe(
        'https://provider.example/gateway/v1beta/models/gemini-test:streamGenerateContent?alt=sse',
      );
      expect(new Headers(init?.headers).get('x-custom')).toBe('preserved');
    },
  );

  it('honors maxRetries:0 instead of letting the native SDK replay an expensive request', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () =>
        Response.json(
          { error: { code: 503, message: 'upstream unavailable', status: 'UNAVAILABLE' } },
          { status: 503 },
        ),
      );
    const runtime = new LobeGoogleAI({ apiKey: 'test', maxRetries: 0 });
    await expect(
      runtime.chat({ messages: [{ content: 'test', role: 'user' }], model: 'gemini-test' }),
    ).rejects.toBeDefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
