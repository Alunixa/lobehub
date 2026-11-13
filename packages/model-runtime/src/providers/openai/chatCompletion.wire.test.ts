// @vitest-environment node
import { once } from 'node:events';
import { createServer } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { createOpenAICompatibleRuntime } from '../../core/openaiCompatibleFactory';
import * as pricing from '../../utils/getModelPricing';
import { LobeOpenAI } from './index';

describe('custom-provider Chat/Completions wire format', () => {
  it('sends a full over-estimate prompt to upstream exactly once without requiring compression', async () => {
    const pricingSpy = vi.spyOn(pricing, 'getModelPricing').mockResolvedValue(undefined);
    const observed: Record<string, unknown>[] = [];
    const content = 'Full context must remain unchanged. '.repeat(1000);
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(chunk);
      observed.push(JSON.parse(Buffer.concat(chunks).toString()));
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.write(
        `data: ${JSON.stringify({ id: 'advisory-test', choices: [{ delta: { content: 'advisory-wire-ok' }, index: 0 }] })}\n\n`,
      );
      response.write(
        `data: ${JSON.stringify({ id: 'advisory-test', choices: [{ delta: {}, finish_reason: 'stop', index: 0 }] })}\n\n`,
      );
      response.end('data: [DONE]\n\n');
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test server port');
    try {
      const Runtime = createOpenAICompatibleRuntime({
        baseURL: `http://127.0.0.1:${address.port}/v1`,
        chatCompletion: {
          contextPreFlight: {
            models: [{ contextWindowTokens: 16, id: 'tight-model', type: 'chat' }],
          },
        },
        provider: 'advisory-context-test',
      });
      const runtime = new Runtime({ apiKey: 'wire-fixture', maxRetries: 0 });
      const result = await runtime.chat({
        messages: [{ content, role: 'user' }],
        model: 'tight-model',
        stream: true,
      });
      expect(await result.text()).toContain('advisory-wire-ok');
      expect(observed).toHaveLength(1);
      expect(observed[0].messages).toEqual([{ content, role: 'user' }]);
    } finally {
      pricingSpy.mockRestore();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('sends the configured bearer key and excludes unsupported DeepSeek verbosity', async () => {
    const pricingSpy = vi.spyOn(pricing, 'getModelPricing').mockResolvedValue(undefined);
    const observed: Array<{ authorization?: string; body: Record<string, unknown>; url?: string }> =
      [];
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(chunk);
      observed.push({
        authorization: request.headers.authorization,
        body: JSON.parse(Buffer.concat(chunks).toString()),
        url: request.url,
      });
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      for (const chunk of [
        { choices: [{ delta: { content: 'wire-ok', role: 'assistant' }, index: 0 }] },
        { choices: [{ delta: {}, finish_reason: 'stop', index: 0 }] },
      ]) {
        response.write(
          `data: ${JSON.stringify({ id: 'test-completion', model: 'deepseek-v4.1-flash', object: 'chat.completion.chunk', ...chunk })}\n\n`,
        );
      }
      response.end('data: [DONE]\n\n');
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test server port');
    try {
      const runtime = new LobeOpenAI({
        apiKey: 'fixture-cn-key',
        baseURL: `http://127.0.0.1:${address.port}/v1`,
        id: 'cn',
        maxRetries: 0,
      });
      const response = await runtime.chat({
        apiMode: 'chatCompletion',
        messages: [{ content: 'Protocol verification', role: 'user' }],
        model: 'deepseek-v4.1-flash',
        stream: true,
        verbosity: 'high',
      });
      expect(await response.text()).toContain('wire-ok');
      expect(observed).toHaveLength(1);
      expect(observed[0]).toMatchObject({
        authorization: 'Bearer fixture-cn-key',
        body: {
          messages: [{ content: 'Protocol verification', role: 'user' }],
          model: 'deepseek-v4.1-flash',
          stream: true,
        },
        url: '/v1/chat/completions',
      });
      expect(observed[0].body).not.toHaveProperty('verbosity');
      expect(observed[0].body).not.toHaveProperty('apiMode');
    } finally {
      pricingSpy.mockRestore();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
