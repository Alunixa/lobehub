// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeAnthropicAI } from '../providers/anthropic';
import { LobeGoogleAI } from '../providers/google';
import { convertOpenAISchemaToGoogleSchema } from '../providers/google/generateObject';
import { LobeOllamaAI } from '../providers/ollama';
import { LobeOpenAI } from '../providers/openai';
import type { ChatStreamPayload } from '../types';
import * as pricing from '../utils/getModelPricing';
import { buildGoogleMessages, buildGoogleTool } from './contextBuilders/google';
import { convertOpenAIMessages, convertOpenAIResponseInputs } from './contextBuilders/openai';
import { transformResponseAPIToStream } from './openaiCompatibleFactory/nonStreamToStream';
import { CloudflareStreamTransformer } from './streams/cloudflare';
import { GoogleGenerativeAIStream } from './streams/google';
import { OpenAIResponsesStream } from './streams/openai/responsesStream';

const call = {
  function: { arguments: '{"city":"Hangzhou"}', name: 'lookup' },
  id: 'call_1',
  type: 'function' as const,
};
const tool = {
  function: { name: 'lookup', parameters: { properties: {}, type: 'object' } },
  type: 'function' as const,
};

beforeEach(() => vi.spyOn(pricing, 'getModelPricing').mockResolvedValue(undefined));
afterEach(() => vi.restoreAllMocks());

async function captureOpenAI(payload: ChatStreamPayload) {
  let captured: { body: Record<string, unknown>; path: string } | undefined;
  const instance = new LobeOpenAI({
    apiKey: 'wire-fixture',
    baseURL: 'http://127.0.0.1:1/v1',
    fetch: async (input, init) => {
      captured = { body: JSON.parse(String(init?.body)), path: new URL(String(input)).pathname };
      return Response.json({ error: { message: 'local capture' } }, { status: 400 });
    },
    maxRetries: 0,
  });
  await expect(instance.chat(payload)).rejects.toBeDefined();
  expect(captured).toBeDefined();
  return captured!;
}

describe('protocol contracts at the HTTP and full response boundaries', () => {
  it('isolates Chat fields even for the simplest hi with retained cross-protocol settings', async () => {
    const request = await captureOpenAI({
      enabledContextCaching: false,
      imageAspectRatio: '1:1',
      imageResolution: '2K',
      messages: [{ content: 'hi', role: 'user' }],
      model: 'gemini-proxy',
      stream: false,
      thinking: { budget_tokens: 1024, type: 'enabled' },
      thinkingBudget: 1024,
      urlContext: true,
    });
    expect(request).toEqual({
      body: { messages: [{ content: 'hi', role: 'user' }], model: 'gemini-proxy', stream: false },
      path: '/v1/chat/completions',
    });
  });

  it('honors an explicit Chat endpoint for a custom GPT model alias', async () => {
    const request = await captureOpenAI({
      apiMode: 'chatCompletion',
      messages: [{ content: 'hi', role: 'user' }],
      model: 'gpt-5.2',
      stream: false,
      max_tokens: 64,
    });
    expect(request.path).toBe('/v1/chat/completions');
    expect(request.body.max_completion_tokens).toBe(64);
    expect(request.body.stream).toBe(false);
    expect(request.body).not.toHaveProperty('max_tokens');
  });

  it('omits tool controls when a Responses request has no callable tools', async () => {
    const request = await captureOpenAI({
      apiMode: 'responses',
      messages: [{ content: 'hi', role: 'user' }],
      model: 'gpt-4o-mini',
      stream: false,
      tool_choice: 'required',
      tools: [],
    });
    expect(request.body).not.toHaveProperty('tool_choice');
    expect(request.body).not.toHaveProperty('parallel_tool_calls');
  });

  it('converts a legacy function result to history instead of an illegal Responses role', async () => {
    expect(
      await convertOpenAIResponseInputs([
        { role: 'function', name: 'lookup', content: 'Old result' },
      ]),
    ).toEqual([
      {
        role: 'assistant',
        content: '[Historical function result: lookup]\nOld result',
      },
    ]);
  });

  it('converts Responses format and named tool choice instead of forwarding Chat options', async () => {
    const request = await captureOpenAI({
      apiMode: 'responses',
      messages: [{ content: 'hi', role: 'user' }],
      model: 'gpt-4o-mini',
      n: 1,
      logprobs: false,
      response_format: { type: 'json_object' },
      stream: false,
      tool_choice: { function: { name: 'lookup' }, type: 'function' },
      tools: [tool],
    });
    expect(request.path).toBe('/v1/responses');
    expect(request.body).toMatchObject({
      stream: false,
      text: { format: { type: 'json_object' } },
      tool_choice: { name: 'lookup', type: 'function' },
    });
    for (const key of ['n', 'logprobs', 'response_format', 'stream_options']) {
      expect(request.body).not.toHaveProperty(key);
    }
  });

  it('preserves real function arguments and prose without fabricating reasoning items', async () => {
    const input = await convertOpenAIResponseInputs([
      {
        content: 'Looking this up',
        reasoning: { content: 'foreign thought' },
        role: 'assistant',
        tool_calls: [call],
      },
      { content: [{ text: 'done', type: 'text' }], role: 'tool', tool_call_id: call.id },
    ]);
    expect(input).toEqual([
      { content: 'Looking this up', role: 'assistant' },
      {
        arguments: call.function.arguments,
        call_id: call.id,
        name: 'lookup',
        type: 'function_call',
      },
      {
        call_id: call.id,
        output: [{ text: 'done', type: 'input_text' }],
        type: 'function_call_output',
      },
    ]);
  });

  it('keeps null assistant content and moves generated images into legal visual inputs', async () => {
    const messages = await convertOpenAIMessages([
      { content: null, role: 'assistant', tool_calls: [call] },
      { content: 'done', role: 'tool', tool_call_id: call.id },
      {
        content: [
          { image_url: { url: 'https://example.invalid/generated.png' }, type: 'image_url' },
        ],
        role: 'assistant',
      },
      { content: 'Please edit that image', role: 'user' },
    ] as never);
    expect(messages[0].content).toBeNull();
    expect(JSON.stringify(messages)).toContain('generated.png');
    expect(
      messages
        .filter((message) => message.role === 'assistant')
        .every((message) => !JSON.stringify(message.content).includes('image_url')),
    ).toBe(true);
  });

  it.each(['incomplete', 'failed'] as const)(
    'preserves a non-streaming %s as an error, retaining partial text',
    async (status) => {
      const response = {
        error: status === 'failed' ? { code: 'server_error', message: 'upstream failed' } : null,
        id: 'resp_1',
        incomplete_details: { reason: 'max_output_tokens' },
        object: 'response',
        output: [
          {
            content: [{ text: 'partial answer', type: 'output_text' }],
            id: 'msg_1',
            role: 'assistant',
            type: 'message',
          },
        ],
        status,
      };
      const text = await new Response(
        OpenAIResponsesStream(transformResponseAPIToStream(response as never), {
          enableStreaming: false,
        }),
      ).text();
      expect(text).toContain('event: error');
      expect(text).not.toContain('event: done');
      if (status === 'incomplete') expect(text).toContain('partial answer');
    },
  );

  it('normalizes Gemini tool turns and retains text alongside real call signatures', async () => {
    const messages = await buildGoogleMessages([
      { content: 'older context', role: 'assistant' },
      {
        content: 'Looking this up',
        role: 'assistant',
        tool_calls: [{ ...call, thoughtSignature: 'real-signature' }],
      },
      { content: 'done', role: 'tool', tool_call_id: call.id },
      { content: 'hi', role: 'user' },
    ]);
    expect(messages[0].role).toBe('user');
    for (let index = 0; index < messages.length; index++) {
      if (messages[index].parts?.some((part) => part.functionCall)) {
        expect(messages[index - 1]?.role).toBe('user');
      }
    }
    expect(JSON.stringify(messages)).toContain('Looking this up');
  });

  it('keeps Gemini JSON Schema types and parameterless tools intact', () => {
    const schema = {
      name: 'score',
      schema: { properties: { score: { type: ['number', 'null'] } }, type: 'object' as const },
    };
    expect(convertOpenAISchemaToGoogleSchema(schema)).toEqual(schema.schema);
    expect(buildGoogleTool(tool).parametersJsonSchema).toEqual({ properties: {}, type: 'object' });
  });

  it('retains Gemini text in the same response block as a function call', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue({
          candidates: [
            {
              content: {
                parts: [
                  { text: 'I will look it up.' },
                  { functionCall: { args: {}, name: 'lookup' } },
                ],
                role: 'model',
              },
              finishReason: 'STOP',
            },
          ],
        });
        controller.close();
      },
    });
    const text = await new Response(GoogleGenerativeAIStream(stream)).text();
    expect(text).toContain('I will look it up.');
    expect(text).toContain('event: tool_calls');
  });

  it('sends native Gemini non-streaming requests with contents and converted tool choice', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        candidates: [{ content: { parts: [{ text: 'ok' }], role: 'model' }, finishReason: 'STOP' }],
      }),
    );
    const runtime = new LobeGoogleAI({ apiKey: 'fixture', maxRetries: 0 });
    await (
      await runtime.chat({
        messages: [{ content: 'hi', role: 'user' }],
        model: 'gemini-3.1-flash',
        stream: false,
        tool_choice: 'none',
        tools: [tool],
      })
    ).text();
    const [url, options] = fetcher.mock.calls[0];
    expect(String(url)).toContain(':generateContent');
    expect(String(url)).not.toContain(':streamGenerateContent');
    const payload = JSON.parse(String(options?.body));
    expect(payload.contents[0].parts[0].text).toBe('hi');
    expect(payload.toolConfig.functionCallingConfig.mode).toBe('NONE');
  });

  it('preserves all Anthropic system instructions and an explicit tool choice', async () => {
    let captured: Record<string, unknown> | undefined;
    const runtime = new LobeAnthropicAI({
      apiKey: 'fixture',
      maxRetries: 0,
      fetch: async (_input: unknown, options?: RequestInit) => {
        captured = JSON.parse(String(options?.body));
        return Response.json(
          { error: { message: 'capture', type: 'invalid_request_error' }, type: 'error' },
          { status: 400 },
        );
      },
    });
    await expect(
      runtime.chat({
        messages: [
          { content: 'first', role: 'system' },
          { content: 'second', role: 'system' },
          { content: 'hi', role: 'user' },
        ],
        model: 'claude-sonnet-4-5',
        stream: false,
        tool_choice: 'none',
        tools: [tool],
      }),
    ).rejects.toBeDefined();
    expect(captured?.system).toEqual([expect.objectContaining({ text: 'first\n\nsecond' })]);
    expect(captured?.tool_choice).toEqual({ type: 'none' });
  });

  it('decodes Cloudflare split UTF-8, terminal frames, JSON bodies and tool calls', async () => {
    const bytes = new TextEncoder().encode(
      'data: {"response":"世界","tool_calls":[{"name":"lookup","arguments":{}}]}\n\ndata: [DONE]',
    );
    const split = bytes.indexOf(0xe4) + 1;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(bytes.slice(0, split));
        controller.enqueue(bytes.slice(split));
        controller.close();
      },
    }).pipeThrough(new TransformStream(new CloudflareStreamTransformer()));
    const chunks: string[] = [];
    for await (const chunk of stream) chunks.push(chunk);
    const text = chunks.join('');
    expect(text).toContain('世界');
    expect(text).toContain('event: tool_calls');
    expect(text).toContain('event: done');
    expect(text).not.toContain('�');
  });

  it('flushes a non-streaming Cloudflare JSON body without a trailing SSE separator', async () => {
    const body = JSON.stringify({ result: { response: 'complete answer' }, success: true });
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }).pipeThrough(new TransformStream(new CloudflareStreamTransformer()));
    const output: string[] = [];
    for await (const chunk of stream) output.push(chunk);
    expect(output.join('')).toContain('complete answer');
    expect(output.join('')).toContain('event: done');
  });

  it('reports a Cloudflare stream ending prematurely while retaining its partial answer', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"response":"partial"}\n\n'));
        controller.close();
      },
    }).pipeThrough(new TransformStream(new CloudflareStreamTransformer()));
    const output: string[] = [];
    for await (const chunk of stream) output.push(chunk);
    expect(output.join('')).toContain('partial');
    expect(output.join('')).toContain('event: error');
    expect(output.join('')).not.toContain('event: done');
  });

  it('sends native Ollama tool history and output limits through its non-streaming endpoint', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        done: true,
        done_reason: 'stop',
        message: { content: 'Ollama answer', role: 'assistant' },
        model: 'llama3',
      }),
    );
    const runtime = new LobeOllamaAI({ baseURL: 'http://127.0.0.1:1' });
    const response = await runtime.chat({
      max_tokens: 128,
      messages: [
        { content: 'hi', role: 'user' },
        { content: 'Looking this up', role: 'assistant', tool_calls: [call] },
        { content: 'Lookup result', role: 'tool', tool_call_id: call.id },
      ],
      model: 'llama3',
      stream: false,
    });
    const payload = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(payload.stream).toBe(false);
    expect(payload.options.num_predict).toBe(128);
    expect(payload.messages[1].tool_calls[0].function.arguments).toEqual({ city: 'Hangzhou' });
    expect(payload.messages[2].tool_name).toBe('lookup');
    expect(await response.text()).toContain('Ollama answer');
  });
});
