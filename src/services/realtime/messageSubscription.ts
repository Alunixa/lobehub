import type { ConversationContext } from '@lobechat/types';

interface MessageSubscriptionCallbacks {
  onReconnect: () => void;
  onUpdate: () => void;
}

interface MessageSubscriptionRecord extends MessageSubscriptionCallbacks {
  context: Pick<ConversationContext, 'agentId' | 'groupId' | 'sessionId' | 'threadId' | 'topicId'>;
  ready: boolean;
}

type ServerMessage =
  | { subscriptionId: string; type: 'messages.updated' }
  | { subscriptionId: string; type: 'subscription.error' }
  | { subscriptionId: string; type: 'subscription.ready' };

const canUseWebSocket = () =>
  typeof window !== 'undefined' &&
  typeof WebSocket !== 'undefined' &&
  ['http:', 'https:'].includes(window.location.protocol);

const getWebSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/trpc-ws`;
};

class MessageSubscriptionClient {
  private fallbackTimer?: ReturnType<typeof setInterval>;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private pongTimer?: ReturnType<typeof setTimeout>;
  private reconnectAttempt = 0;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private resumeTimer?: ReturnType<typeof setTimeout>;
  private socket?: WebSocket;
  private subscriptions = new Map<string, MessageSubscriptionRecord>();

  private attachLifecycle = () => {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('focus', this.handleResume);
    window.addEventListener('online', this.handleResume);
    window.addEventListener('pageshow', this.handleResume);
    window.addEventListener('pagehide', this.closeSocket);
    this.fallbackTimer = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      this.ensureConnected();
      for (const [id, subscription] of this.subscriptions) {
        if (subscription.ready) continue;
        subscription.onReconnect();
        this.sendSubscription(id, subscription);
      }
    }, 30_000);
  };

  private detachLifecycle = () => {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('focus', this.handleResume);
    window.removeEventListener('online', this.handleResume);
    window.removeEventListener('pageshow', this.handleResume);
    window.removeEventListener('pagehide', this.closeSocket);
    clearInterval(this.fallbackTimer);
    this.fallbackTimer = undefined;
  };

  subscribe(context: ConversationContext, callbacks: MessageSubscriptionCallbacks): () => void {
    const subscriptionId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `messages-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    if (this.subscriptions.size === 0) this.attachLifecycle();
    const subscription: MessageSubscriptionRecord = {
      ...callbacks,
      context: {
        agentId: context.agentId,
        groupId: context.groupId,
        sessionId: context.sessionId,
        threadId: context.threadId,
        topicId: context.topicId,
      },
      ready: false,
    };
    this.subscriptions.set(subscriptionId, subscription);
    if (this.socket?.readyState === WebSocket.OPEN)
      this.sendSubscription(subscriptionId, subscription);
    else this.ensureConnected();

    return () => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ subscriptionId, type: 'unsubscribeMessages' }));
      }
      this.subscriptions.delete(subscriptionId);
      if (this.subscriptions.size === 0) {
        this.closeSocket();
        this.detachLifecycle();
      }
    };
  }

  private sendSubscription = (id: string, subscription: MessageSubscriptionRecord) => {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(
      JSON.stringify({
        context: subscription.context,
        subscriptionId: id,
        type: 'subscribeMessages',
      }),
    );
  };

  private closeSocket = () => {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    clearTimeout(this.resumeTimer);
    this.resumeTimer = undefined;
    this.stopHeartbeat();
    for (const subscription of this.subscriptions.values()) subscription.ready = false;
    const socket = this.socket;
    this.socket = undefined;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, 'Client idle');
  };

  private stopHeartbeat = () => {
    clearInterval(this.heartbeatTimer);
    clearTimeout(this.pongTimer);
    this.heartbeatTimer = undefined;
    this.pongTimer = undefined;
  };

  private ping = () => {
    if (this.socket?.readyState !== WebSocket.OPEN || this.pongTimer) return;
    const socket = this.socket;
    socket.send('PING');
    this.pongTimer = setTimeout(() => {
      if (this.socket !== socket) return;
      this.closeSocket();
      this.ensureConnected();
    }, 10_000);
  };

  private ensureConnected = () => {
    if (
      !canUseWebSocket() ||
      this.subscriptions.size === 0 ||
      document.visibilityState === 'hidden' ||
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    )
      return;

    const socket = new WebSocket(getWebSocketUrl());
    this.socket = socket;

    socket.addEventListener('open', () => {
      if (this.socket !== socket) return;
      this.reconnectAttempt = 0;
      for (const [subscriptionId, subscription] of this.subscriptions) {
        this.sendSubscription(subscriptionId, subscription);
      }
      this.heartbeatTimer = setInterval(this.ping, 15_000);
    });

    socket.addEventListener('message', (event) => {
      if (this.socket !== socket || typeof event.data !== 'string') return;
      if (event.data === 'PONG') {
        clearTimeout(this.pongTimer);
        this.pongTimer = undefined;
        return;
      }

      let message: ServerMessage;
      try {
        message = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }

      const subscription = this.subscriptions.get(message.subscriptionId);
      if (!subscription) return;

      if (message.type === 'messages.updated') {
        subscription.onUpdate();
        return;
      }

      if (message.type === 'subscription.ready') {
        subscription.ready = true;
        // The first handshake also closes the fetch-to-subscribe race.
        subscription.onReconnect();
      }
      if (message.type === 'subscription.error') {
        subscription.ready = false;
        subscription.onReconnect();
      }
    });

    const reconnect = () => {
      if (this.socket !== socket) return;
      this.stopHeartbeat();
      for (const subscription of this.subscriptions.values()) subscription.ready = false;
      this.socket = undefined;
      if (this.subscriptions.size === 0 || document.visibilityState === 'hidden') return;

      const delay = Math.min(30_000, 1000 * 2 ** Math.min(this.reconnectAttempt, 5));
      this.reconnectAttempt += 1;
      this.reconnectTimer = setTimeout(this.ensureConnected, delay);
    };

    socket.addEventListener('close', reconnect);
    socket.addEventListener('error', () => socket.close());
  };

  private handleResume = () => {
    if (document.visibilityState === 'hidden' || this.subscriptions.size === 0) return;
    this.ensureConnected();
    this.ping();
    if (this.resumeTimer) return;
    this.resumeTimer = setTimeout(() => {
      this.resumeTimer = undefined;
      for (const subscription of this.subscriptions.values()) subscription.onReconnect();
    }, 50);
  };

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      this.closeSocket();
      return;
    }
    this.handleResume();
  };
}

let client: MessageSubscriptionClient | undefined;

export const subscribeToMessageUpdates = (
  context: ConversationContext,
  callbacks: MessageSubscriptionCallbacks,
): (() => void) => {
  if (!canUseWebSocket()) return () => {};
  client ??= new MessageSubscriptionClient();
  return client.subscribe(context, callbacks);
};
