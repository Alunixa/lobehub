// @vitest-environment node
import OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';

import { OpenAIStream } from '../streams/openai/openai';
import { OpenAIResponsesStream } from '../streams/openai/responsesStream';
import { createStreamingFetch } from './streamingFetch';

describe('compatible HTTP stream normalization', () => {
  const client = (fetcher: typeof fetch) =>
    new OpenAI({
      apiKey: 'test',
      baseURL: 'https://provider.example/v1',
      fetch: createStreamingFetch(fetcher),
      maxRetries: 0,
    });

  it('flushes a terminal SSE frame with no trailing blank line through the real SDK', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          'data: {"id":"c","choices":[{"delta":{"content":"answer"},"finish_reason":"stop"}]}',
          { headers: { 'content-type': 'text/event-stream' } },
        ),
      );
    const upstream = await client(fetcher).chat.completions.create({
      messages: [],
      model: 'test',
      stream: true,
    });
    const onCompletion = vi.fn();
    const onError = vi.fn();
    await new Response(OpenAIStream(upstream, { callbacks: { onCompletion, onError } })).text();
    expect(onCompletion).toHaveBeenCalledWith(expect.objectContaining({ text: 'answer' }));
    expect(onError).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('decodes JSON ChatCompletion returned despite stream:true without another request', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        choices: [
          {
            finish_reason: 'stop',
            index: 0,
            message: { content: 'json answer', role: 'assistant' },
          },
        ],
        id: 'c',
        object: 'chat.completion',
      }),
    );
    const upstream = await client(fetcher).chat.completions.create({
      messages: [],
      model: 'test',
      stream: true,
    });
    const onCompletion = vi.fn();
    await new Response(OpenAIStream(upstream, { callbacks: { onCompletion } })).text();
    expect(onCompletion).toHaveBeenCalledWith(expect.objectContaining({ text: 'json answer' }));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('decodes a JSON Responses result without losing the output array', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        id: 'r',
        object: 'response',
        status: 'completed',
        output: [
          {
            content: [{ annotations: [], text: 'response answer', type: 'output_text' }],
            id: 'a',
            role: 'assistant',
            type: 'message',
          },
        ],
      }),
    );
    const upstream = await client(fetcher).responses.create({
      input: 'test',
      model: 'test',
      stream: true,
    });
    const onCompletion = vi.fn();
    await new Response(OpenAIResponsesStream(upstream, { callbacks: { onCompletion } })).text();
    expect(onCompletion).toHaveBeenCalledWith(expect.objectContaining({ text: 'response answer' }));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('still reports a genuinely truncated stream rather than synthesizing success', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          'data: {"id":"c","choices":[{"delta":{"content":"partial"},"finish_reason":null}]}',
          { headers: { 'content-type': 'text/event-stream' } },
        ),
      );
    const upstream = await client(fetcher).chat.completions.create({
      messages: [],
      model: 'test',
      stream: true,
    });
    const onError = vi.fn();
    await new Response(OpenAIStream(upstream, { callbacks: { onError } })).text();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ type: 'StreamChunkError' }));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('leaves nonstream JSON requests and HTTP errors untouched', async () => {
    const response = Response.json({ choices: [] });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
    expect(
      await createStreamingFetch(fetcher)('https://provider.example/v1/chat/completions', {
        body: '{"stream":false}',
        method: 'POST',
      }),
    ).toBe(response);
    const failed = Response.json({ error: { message: 'failed' } }, { status: 502 });
    fetcher.mockResolvedValueOnce(failed);
    expect(
      await createStreamingFetch(fetcher)('https://provider.example/v1/responses', {
        body: '{"stream":true}',
        method: 'POST',
      }),
    ).toBe(failed);
  });
});
