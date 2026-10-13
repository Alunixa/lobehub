// @vitest-environment node
import { createServer } from 'node:http';

import { describe, expect, it } from 'vitest';

import { formatErrorForState } from '../AgentRuntime/formatErrorForState';
import { createLlmRequestTiming } from '../AgentRuntime/llmRequestTiming';
import { initModelRuntimeWithUserPayload } from './index';

describe('completed upstream work with a disconnected response', () => {
  it.each(['chatCompletion', 'responses'] as const)(
    'preserves the %s network failure and configured provider without repeating work',
    async (apiMode) => {
      let processedRequests = 0;
      const requestTiming = createLlmRequestTiming();
      const server = createServer((request) => {
        request.resume();
        request.once('end', () => {
          // The fixture completes its work but closes before sending any response headers.
          processedRequests++;
          request.socket.destroy();
        });
      });

      try {
        await new Promise<void>((resolve, reject) => {
          server.once('error', reject);
          server.listen(0, '127.0.0.1', resolve);
        });
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('Missing fixture address');

        const runtime = initModelRuntimeWithUserPayload(
          'custom-channel',
          {
            apiKey: 'local-fixture-key',
            baseURL: `http://127.0.0.1:${address.port}/v1`,
            runtimeProvider: 'openai',
          },
          { maxRetries: 0 },
        );
        let failure: unknown;
        try {
          await requestTiming.run(() =>
            runtime.chat({
              apiMode,
              messages: [{ content: 'local connection fixture', role: 'user' }],
              model: 'gemini-3.8-flash',
              stream: true,
            }),
          );
        } catch (error) {
          failure = requestTiming.enrichError(error);
        }

        expect(failure).toBeDefined();
        const serialized = JSON.stringify(formatErrorForState(failure));
        const persisted = JSON.parse(serialized);
        expect(processedRequests).toBe(1);
        expect(persisted.message).toBe('Connection error.');
        expect(persisted.type).toBe('ProviderNetworkError');
        expect(persisted.body).toMatchObject({
          cause: { code: 'UND_ERR_SOCKET', message: 'other side closed', name: 'SocketError' },
          message: 'fetch failed',
          name: 'TypeError',
          provider: 'custom-channel',
          requestTiming: {
            phase: 'awaiting_headers',
            requestCount: 1,
            transportErrorCode: 'UND_ERR_SOCKET',
          },
        });
        expect(JSON.stringify(persisted)).not.toContain('local-fixture-key');
      } finally {
        requestTiming.dispose();
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    },
  );
});
