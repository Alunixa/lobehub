import type OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';

import { transformResponseAPIToStream } from '../../packages/model-runtime/src/core/openaiCompatibleFactory/nonStreamToStream';
import { OpenAIStream } from '../../packages/model-runtime/src/core/streams/openai/openai';
import { OpenAIResponsesStream } from '../../packages/model-runtime/src/core/streams/openai/responsesStream';

const source = (events: unknown[]) =>
  new ReadableStream({
    start(controller) {
      events.forEach((event) => controller.enqueue(event));
      controller.close();
    },
  });
const message = (text: string, id = 'answer'): OpenAI.Responses.ResponseOutputMessage => ({
  content: [{ annotations: [], text, type: 'output_text' }],
  id,
  role: 'assistant',
  status: 'completed',
  type: 'message',
});
const completed = (output: unknown[]) => ({
  response: { id: 'r', output, status: 'completed' },
  type: 'response.completed',
});

describe('same-response completion recovery', () => {
  it.each(['text', 'part', 'item', 'completed'])(
    'recovers final-only Responses %s output',
    async (kind) => {
      const item = message('Recovered answer');
      const events = {
        completed: [],
        item: [{ item, output_index: 0, type: 'response.output_item.done' }],
        part: [
          {
            content_index: 0,
            item_id: 'answer',
            output_index: 0,
            part: item.content[0],
            type: 'response.content_part.done',
          },
        ],
        text: [
          {
            content_index: 0,
            item_id: 'answer',
            output_index: 0,
            text: 'Recovered answer',
            type: 'response.output_text.done',
          },
        ],
      };
      const onCompletion = vi.fn();
      const onError = vi.fn();
      await new Response(
        OpenAIResponsesStream(
          source([
            ...events[kind as keyof typeof events],
            completed(kind === 'completed' ? [item] : []),
          ]),
          { callbacks: { onCompletion, onError } },
        ),
      ).text();
      expect(onCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Recovered answer' }),
      );
      expect(onError).not.toHaveBeenCalled();
    },
  );

  it('appends only missing text and does not duplicate repeated final snapshots', async () => {
    const item = message('Hello world');
    const onCompletion = vi.fn();
    await new Response(
      OpenAIResponsesStream(
        source([
          {
            content_index: 0,
            delta: 'Hello',
            item_id: 'answer',
            output_index: 0,
            type: 'response.output_text.delta',
          },
          {
            content_index: 0,
            item_id: 'answer',
            output_index: 0,
            text: 'Hello world',
            type: 'response.output_text.done',
          },
          { item, output_index: 0, type: 'response.output_item.done' },
          completed([item]),
        ]),
        { callbacks: { onCompletion } },
      ),
    ).text();
    expect(onCompletion).toHaveBeenCalledWith(expect.objectContaining({ text: 'Hello world' }));
  });

  it('keeps identical text from distinct content parts and output items', async () => {
    const first = message('same', 'a');
    first.content.push(first.content[0]);
    const onCompletion = vi.fn();
    await new Response(
      OpenAIResponsesStream(source([completed([first, message('same', 'b')])]), {
        callbacks: { onCompletion },
      }),
    ).text();
    expect(onCompletion).toHaveBeenCalledWith(expect.objectContaining({ text: 'samesamesame' }));
  });

  it('recovers final-only tools and routes interleaved argument deltas to their own call', async () => {
    const call = (id: string, name: string, args: string) => ({
      arguments: args,
      call_id: `call_${id}`,
      id,
      name,
      type: 'function_call',
    });
    const onCompletion = vi.fn();
    await new Response(
      OpenAIResponsesStream(
        source([
          { item: call('a', 'alpha', ''), output_index: 0, type: 'response.output_item.added' },
          { item: call('b', 'beta', ''), output_index: 1, type: 'response.output_item.added' },
          {
            delta: '{"a":',
            item_id: 'a',
            output_index: 0,
            type: 'response.function_call_arguments.delta',
          },
          {
            delta: '{"b":2}',
            item_id: 'b',
            output_index: 1,
            type: 'response.function_call_arguments.delta',
          },
          {
            arguments: '{"a":1}',
            item_id: 'a',
            output_index: 0,
            type: 'response.function_call_arguments.done',
          },
          completed([
            call('a', 'alpha', '{"a":1}'),
            call('b', 'beta', '{"b":2}'),
            call('c', 'gamma', '{}'),
          ]),
        ]),
        { callbacks: { onCompletion } },
      ),
    ).text();
    expect(onCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        toolsCalling: [
          expect.objectContaining({
            function: { arguments: '{"a":1}', name: 'alpha' },
            id: 'call_a',
          }),
          expect.objectContaining({
            function: { arguments: '{"b":2}', name: 'beta' },
            id: 'call_b',
          }),
          expect.objectContaining({ function: { arguments: '{}', name: 'gamma' }, id: 'call_c' }),
        ],
      }),
    );
  });

  it('shows a final refusal as visible output instead of an empty completion', async () => {
    const onCompletion = vi.fn();
    await new Response(
      OpenAIResponsesStream(
        source([
          completed([
            {
              ...message(''),
              content: [{ refusal: 'Unable to answer this request.', type: 'refusal' }],
            },
          ]),
        ]),
        { callbacks: { onCompletion } },
      ),
    ).text();
    expect(onCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Unable to answer this request.' }),
    );
  });

  it('does not count a final output-item snapshot as a terminal response event', async () => {
    const onError = vi.fn();
    await new Response(
      OpenAIResponsesStream(
        source([{ item: message('partial'), output_index: 0, type: 'response.output_item.done' }]),
        { callbacks: { onError } },
      ),
    ).text();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ type: 'StreamChunkError' }));
  });

  it('preserves the empty-success guard for genuinely empty Responses completions', async () => {
    const onCompletion = vi.fn();
    await new Response(
      OpenAIResponsesStream(source([completed([])]), {
        callbacks: { onCompletion },
      }),
    ).text();
    expect(onCompletion).toHaveBeenCalledWith(expect.objectContaining({ text: '' }));
  });

  it('recovers a ChatCompletion message sent inside SSE', async () => {
    const onCompletion = vi.fn();
    const onError = vi.fn();
    await new Response(
      OpenAIStream(
        source([
          {
            choices: [
              {
                finish_reason: 'stop',
                index: 0,
                message: { content: 'Complete answer', role: 'assistant' },
              },
            ],
            id: 'c',
            object: 'chat.completion',
            usage: { completion_tokens: 3, prompt_tokens: 2, total_tokens: 5 },
          },
        ]),
        { callbacks: { onCompletion, onError } },
      ),
    ).text();
    expect(onCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Complete answer',
        usage: expect.objectContaining({ totalTokens: 5 }),
      }),
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it('does not duplicate text in intentionally nonstreaming Responses conversions', async () => {
    const onCompletion = vi.fn();
    await new Response(
      OpenAIResponsesStream(
        transformResponseAPIToStream({
          created_at: 0,
          error: null,
          id: 'r',
          incomplete_details: null,
          instructions: null,
          metadata: null,
          model: 'test',
          object: 'response',
          output: [message('Only once')],
          output_text: 'Only once',
          parallel_tool_calls: false,
          status: 'completed',
          temperature: null,
          tool_choice: 'auto',
          tools: [],
          top_p: null,
        }),
        { callbacks: { onCompletion } },
      ),
    ).text();
    expect(onCompletion).toHaveBeenCalledWith(expect.objectContaining({ text: 'Only once' }));
  });
});
