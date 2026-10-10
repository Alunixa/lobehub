import { describe, expect, it, vi } from 'vitest';

import { AnthropicStream } from '../../packages/model-runtime/src/core/streams/anthropic';
import { OpenAIStream } from '../../packages/model-runtime/src/core/streams/openai/openai';
import { OpenAIResponsesStream } from '../../packages/model-runtime/src/core/streams/openai/responsesStream';

const stream = (events: unknown[]) =>
  new ReadableStream({
    start(controller) {
      events.forEach((event) => controller.enqueue(event));
      controller.close();
    },
  });
const read = (input: ReadableStream<Uint8Array>) => new Response(input).text();
const start = {
  type: 'message_start',
  message: { id: 'm', usage: { input_tokens: 2, output_tokens: 0 } },
};

describe('provider failures do not become empty success', () => {
  it('keeps text containing an embedded data: marker instead of silently dropping it', async () => {
    const onText = vi.fn();
    await read(
      OpenAIStream(
        stream([
          {
            id: 'c',
            choices: [{ delta: { content: 'Example data: preserved.' }, finish_reason: null }],
          },
          { id: 'c', choices: [{ delta: {}, finish_reason: 'stop' }] },
        ]),
        { callbacks: { onText } },
      ),
    );
    expect(onText).toHaveBeenCalledWith('Example data: preserved.');
  });

  it('accepts a valid terminal frame that also carries the last text delta', async () => {
    const onError = vi.fn();
    const onText = vi.fn();
    const response = await read(
      OpenAIStream(
        stream([
          { id: 'c', choices: [{ delta: { content: 'final answer' }, finish_reason: 'stop' }] },
        ]),
        { callbacks: { onError, onText } },
      ),
    );
    expect(onError).not.toHaveBeenCalled();
    expect(onText).toHaveBeenCalledWith('final answer');
    expect(response).toContain('event: stop');
  });

  it('preserves an Anthropic error frame after thinking output', async () => {
    const onError = vi.fn();
    const onThinking = vi.fn();
    const response = await read(
      AnthropicStream(
        stream([
          start,
          { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'progress' } },
          { type: 'error', error: { type: 'overloaded_error', message: 'request failed' } },
        ]),
        { callbacks: { onError, onThinking } },
      ),
    );
    expect(onThinking).toHaveBeenCalledWith('progress');
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'request failed',
        type: 'ProviderBizError',
        body: { error: { type: 'overloaded_error', message: 'request failed' } },
      }),
    );
    expect(response).not.toContain('content policy');
  });

  it('surfaces SDK iterator network failures in the native Anthropic path', async () => {
    const source = {
      async *[Symbol.asyncIterator]() {
        yield start;
        throw new Error('ECONNRESET upstream connection failed');
      },
    };
    const onError = vi.fn();
    const response = await read(
      AnthropicStream(source as Parameters<typeof AnthropicStream>[0], {
        callbacks: { onError },
      }),
    );
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ type: 'ProviderBizError' }));
    expect(response).toContain('ECONNRESET upstream connection failed');
  });

  it('captures text carried directly in content_block_start', async () => {
    const onText = vi.fn();
    await read(
      AnthropicStream(
        stream([
          start,
          {
            type: 'content_block_start',
            index: 0,
            content_block: { type: 'text', text: 'actual answer' },
          },
          { type: 'message_delta', delta: { stop_reason: 'end_turn' } },
          { type: 'message_stop' },
        ]),
        { callbacks: { onText } },
      ),
    );
    expect(onText).toHaveBeenCalledWith('actual answer');
  });

  it('does not treat a usage frame as a complete OpenAI response when the stream closes early', async () => {
    const onError = vi.fn();
    await read(
      OpenAIStream(
        stream([
          { id: 'c', choices: [{ delta: { content: 'partial' }, finish_reason: null }] },
          {
            id: 'c',
            choices: [],
            usage: { prompt_tokens: 100, completion_tokens: 688, total_tokens: 788 },
          },
        ]),
        { callbacks: { onError } },
      ),
    );
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'StreamChunkError',
        message: 'Stream ended unexpectedly',
      }),
    );
  });

  it('surfaces Responses API failures with their original message', async () => {
    const onError = vi.fn();
    await read(
      OpenAIResponsesStream(
        stream([
          { type: 'response.created', response: { id: 'r', status: 'in_progress' } },
          {
            type: 'response.failed',
            response: { id: 'r', error: { code: 'upstream_error', message: 'request failed' } },
          },
        ]),
        { callbacks: { onError } },
      ),
    );
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ProviderBizError', message: 'request failed' }),
    );
  });

  it('reports an abrupt Responses reasoning stream close, rather than completing to an empty answer', async () => {
    const onError = vi.fn();
    const onThinking = vi.fn();
    await read(
      OpenAIResponsesStream(
        stream([
          { type: 'response.created', response: { id: 'r', status: 'in_progress' } },
          { type: 'response.reasoning_text.delta', item_id: 'thinking', delta: 'in progress' },
        ]),
        { callbacks: { onError, onThinking } },
      ),
    );
    expect(onThinking).toHaveBeenCalledWith('in progress');
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ type: 'StreamChunkError' }));
  });

  it('delivers raw thinking and text while the producer is still running', async () => {
    let controller!: ReadableStreamDefaultController;
    const source = new ReadableStream({
      start(value) {
        controller = value;
      },
    });
    const onThinking = vi.fn();
    const onText = vi.fn();
    const pending = read(OpenAIResponsesStream(source, { callbacks: { onThinking, onText } }));
    controller.enqueue({ type: 'response.created', response: { id: 'r', status: 'in_progress' } });
    controller.enqueue({
      type: 'response.reasoning_text.delta',
      item_id: 'thought',
      delta: 'thinking',
    });
    await vi.waitFor(() => expect(onThinking).toHaveBeenCalledWith('thinking'));
    controller.enqueue({ type: 'response.output_text.delta', item_id: 'answer', delta: 'answer' });
    await vi.waitFor(() => expect(onText).toHaveBeenCalledWith('answer'));
    controller.enqueue({ type: 'response.completed', response: { id: 'r', status: 'completed' } });
    controller.close();
    await pending;
  });
});
