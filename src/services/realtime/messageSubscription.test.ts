/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MockWebSocket extends EventTarget {
  static CLOSED = 3;
  static CLOSING = 2;
  static CONNECTING = 0;
  static OPEN = 1;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  url: string;

  constructor(url: string) {
    super();
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  close() {
    if (this.readyState === MockWebSocket.CLOSED) return;
    this.readyState = MockWebSocket.CLOSED;
    this.dispatchEvent(new Event('close'));
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }

  receive(payload: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(payload) }));
  }

  send(payload: string) {
    this.sent.push(payload);
  }
}

describe('message subscription client', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('subscribes, forwards updates and revalidates after reconnect readiness', async () => {
    const { subscribeToMessageUpdates } = await import('./messageSubscription');
    const onReconnect = vi.fn();
    const onUpdate = vi.fn();
    const unsubscribe = subscribeToMessageUpdates(
      { agentId: 'agent-1', topicId: 'topic-1' },
      { onReconnect, onUpdate },
    );

    const firstSocket = MockWebSocket.instances[0];
    expect(firstSocket.url).toMatch(/\/api\/trpc-ws$/);
    firstSocket.open();
    const firstSubscription = JSON.parse(firstSocket.sent[0]);
    expect(firstSubscription).toEqual(
      expect.objectContaining({
        context: expect.objectContaining({ agentId: 'agent-1', topicId: 'topic-1' }),
        type: 'subscribeMessages',
      }),
    );

    firstSocket.receive({
      subscriptionId: firstSubscription.subscriptionId,
      type: 'subscription.ready',
    });
    firstSocket.receive({
      subscriptionId: firstSubscription.subscriptionId,
      type: 'messages.updated',
    });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onReconnect).not.toHaveBeenCalled();

    firstSocket.close();
    await vi.advanceTimersByTimeAsync(1000);
    const secondSocket = MockWebSocket.instances[1];
    secondSocket.open();
    const secondSubscription = JSON.parse(secondSocket.sent[0]);
    secondSocket.receive({
      subscriptionId: secondSubscription.subscriptionId,
      type: 'subscription.ready',
    });
    expect(onReconnect).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(JSON.parse(secondSocket.sent.at(-1)!)).toEqual({
      subscriptionId: secondSubscription.subscriptionId,
      type: 'unsubscribeMessages',
    });
  });
});
