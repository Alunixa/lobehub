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
  autoPong = true;
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
    if (payload === 'PING' && this.autoPong)
      queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: 'PONG' })));
  }
}

describe('message subscription client', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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
    expect(onReconnect).toHaveBeenCalledTimes(1);

    firstSocket.close();
    await vi.advanceTimersByTimeAsync(1000);
    const secondSocket = MockWebSocket.instances[1];
    secondSocket.open();
    const secondSubscription = JSON.parse(secondSocket.sent[0]);
    secondSocket.receive({
      subscriptionId: secondSubscription.subscriptionId,
      type: 'subscription.ready',
    });
    expect(onReconnect).toHaveBeenCalledTimes(2);

    unsubscribe();
    expect(JSON.parse(secondSocket.sent.at(-1)!)).toEqual({
      subscriptionId: secondSubscription.subscriptionId,
      type: 'unsubscribeMessages',
    });
  });

  it('registers another conversation on an already-open shared socket', async () => {
    const { subscribeToMessageUpdates } = await import('./messageSubscription');
    const callbacks = { onReconnect: vi.fn(), onUpdate: vi.fn() };
    const first = subscribeToMessageUpdates({ agentId: 'agent-1', topicId: 'topic-1' }, callbacks);
    const socket = MockWebSocket.instances[0];
    socket.open();
    const second = subscribeToMessageUpdates({ agentId: 'agent-1', topicId: 'topic-2' }, callbacks);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(socket.sent.map((payload) => JSON.parse(payload).context.topicId)).toEqual([
      'topic-1',
      'topic-2',
    ]);
    first();
    second();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('restores a pagehide/pageshow connection even when visibility never changes', async () => {
    const { subscribeToMessageUpdates } = await import('./messageSubscription');
    const onReconnect = vi.fn();
    const dispose = subscribeToMessageUpdates(
      { agentId: 'agent-1', topicId: 'topic-1' },
      { onReconnect, onUpdate: vi.fn() },
    );
    const socket = MockWebSocket.instances[0];
    socket.open();
    window.dispatchEvent(new Event('pagehide'));
    expect(socket.readyState).toBe(MockWebSocket.CLOSED);
    window.dispatchEvent(new Event('pageshow'));
    const replacement = MockWebSocket.instances[1];
    replacement.open();
    await vi.advanceTimersByTimeAsync(50);
    expect(onReconnect).toHaveBeenCalled();
    expect(MockWebSocket.instances).toHaveLength(2);
    dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('refreshes on focus/online without restarting a healthy socket for each event', async () => {
    const { subscribeToMessageUpdates } = await import('./messageSubscription');
    const onReconnect = vi.fn();
    const dispose = subscribeToMessageUpdates(
      { agentId: 'agent-1', topicId: 'topic-1' },
      { onReconnect, onUpdate: vi.fn() },
    );
    const socket = MockWebSocket.instances[0];
    socket.open();
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(50);
    expect(onReconnect).toHaveBeenCalledTimes(1);
    expect(MockWebSocket.instances).toHaveLength(1);
    dispose();
  });

  it('replaces a silently dead open socket when its heartbeat goes unanswered', async () => {
    const { subscribeToMessageUpdates } = await import('./messageSubscription');
    const dispose = subscribeToMessageUpdates(
      { agentId: 'agent-1', topicId: 'topic-1' },
      { onReconnect: vi.fn(), onUpdate: vi.fn() },
    );
    const socket = MockWebSocket.instances[0];
    socket.autoPong = false;
    socket.open();
    await vi.advanceTimersByTimeAsync(25_000);
    expect(socket.sent).toContain('PING');
    expect(socket.readyState).toBe(MockWebSocket.CLOSED);
    expect(MockWebSocket.instances).toHaveLength(2);
    dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('falls back to HTTP invalidation after registration errors instead of silently staying stale', async () => {
    const { subscribeToMessageUpdates } = await import('./messageSubscription');
    const onReconnect = vi.fn();
    const dispose = subscribeToMessageUpdates(
      { agentId: 'agent-1', topicId: 'topic-1' },
      { onReconnect, onUpdate: vi.fn() },
    );
    const socket = MockWebSocket.instances[0];
    socket.open();
    const { subscriptionId } = JSON.parse(socket.sent[0]);
    socket.receive({ subscriptionId, type: 'subscription.error' });
    expect(onReconnect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(onReconnect).toHaveBeenCalledTimes(2);
    dispose();
  });

  it('does not repeatedly fetch healthy registered conversations on the fallback timer', async () => {
    const { subscribeToMessageUpdates } = await import('./messageSubscription');
    const onReconnect = vi.fn();
    const dispose = subscribeToMessageUpdates(
      { agentId: 'agent-1', topicId: 'topic-1' },
      { onReconnect, onUpdate: vi.fn() },
    );
    const socket = MockWebSocket.instances[0];
    socket.open();
    const { subscriptionId } = JSON.parse(socket.sent[0]);
    socket.receive({ subscriptionId, type: 'subscription.ready' });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(onReconnect).toHaveBeenCalledTimes(1);
    expect(MockWebSocket.instances).toHaveLength(1);
    dispose();
  });
});
