// @vitest-environment happy-dom
import type { FetchEventSourceInit } from '@lobechat/utils/client/fetchEventSource/index';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ServerAgentStreamClient } from '@/services/agentRuntime/serverStreamClient';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), interrupt: vi.fn() }));
vi.mock('@/services/aiAgent', () => ({ aiAgentService: { interruptTask: mocks.interrupt } }));
vi.mock('@/services/_auth', () => ({ createHeaderWithAuth: async () => ({}) }));
vi.mock('@/business/client/trpc-headers', () => ({ getBusinessTrpcHeaders: async () => ({}) }));
vi.mock('@lobechat/utils/client', () => ({
  CLOSE_EVENT_SOURCE: Symbol('end'),
  fetchEventSource: (...args: unknown[]) => mocks.fetch(...args),
}));

const clients: ServerAgentStreamClient[] = [];
const create = () => {
  const client = new ServerAgentStreamClient({
    gatewayUrl: '',
    operationId: 'op-owner',
    token: '',
  });
  clients.push(client);
  return client;
};
afterEach(() => {
  clients.splice(0).forEach((client) => client.disconnect());
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('resumable server transport', () => {
  it('reconnects after a dropped subscription without restarting or interrupting generation', async () => {
    vi.useFakeTimers();
    const events = vi.fn();
    mocks.fetch
      .mockImplementationOnce(async (_url: string, options: FetchEventSourceInit) => {
        await options.onopen(new Response('', { status: 200 }));
        options.onmessage?.({
          data: JSON.stringify({
            data: { content: 'first' },
            id: '100-0',
            operationId: 'op-owner',
            type: 'stream_chunk',
          }),
          event: 'stream_chunk',
          id: '100-0',
        });
      })
      .mockImplementationOnce(
        (_url: string, options: FetchEventSourceInit) =>
          new Promise<void>((resolve) =>
            options.signal?.addEventListener('abort', () => resolve()),
          ),
      );
    const client = create();
    client.on('agent_event', events);
    client.connect();
    await vi.advanceTimersByTimeAsync(1001);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.fetch.mock.calls[1][0]).toContain('lastEventId=100-0');
    expect(events).toHaveBeenCalledTimes(1);
    client.disconnect();
    expect(mocks.interrupt).not.toHaveBeenCalled();
  });

  it('hiding the tab does not abort the subscription', async () => {
    mocks.fetch.mockImplementationOnce(
      (_url: string, options: FetchEventSourceInit) =>
        new Promise<void>((resolve) => options.signal?.addEventListener('abort', () => resolve())),
    );
    const client = create();
    client.connect();
    await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    const signal = mocks.fetch.mock.calls[0][1].signal as AbortSignal;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(signal.aborted).toBe(false);
    expect(mocks.interrupt).not.toHaveBeenCalled();
  });

  it('only a terminal event belonging to this operation completes the viewer', async () => {
    const complete = vi.fn();
    mocks.fetch.mockImplementationOnce(async (_url: string, options: FetchEventSourceInit) => {
      await options.onopen(new Response('', { status: 200 }));
      options.onmessage?.({
        data: JSON.stringify({ operationId: 'op-member', type: 'agent_runtime_end' }),
        event: 'agent_runtime_end',
        id: '',
      });
      expect(complete).not.toHaveBeenCalled();
      options.onmessage?.({
        data: JSON.stringify({ operationId: 'op-owner', type: 'agent_runtime_end' }),
        event: 'agent_runtime_end',
        id: '',
      });
    });
    const client = create();
    client.on('session_complete', complete);
    client.connect();
    await vi.waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
    expect(mocks.interrupt).not.toHaveBeenCalled();
  });
});
