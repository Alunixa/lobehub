import type { ConversationContext } from '@lobechat/types';

interface MessageSubscriptionCallbacks {
  onReconnect: () => void;
  onUpdate: () => void;
}

interface MessageSubscriptionRecord extends MessageSubscriptionCallbacks {
  context: Pick<
    ConversationContext,
    'agentId' | 'groupId' | 'sessionId' | 'threadId' | 'topicId'
  >;
  readyCount: number;
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
  private reconnectAttempt = 0;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private socket?: WebSocket;
  private subscriptions = new Map<string, MessageSubscriptionRecord>();

  constructor() {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('online', this.ensureConnected);
    window.addEventListener('pagehide', this.closeSocket);
  }

  subscribe(
    context: ConversationContext,
    callbacks: MessageSubscriptionCallbacks,
  ): () => void {
    const subscriptionId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `messages-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    this.subscriptions.set(subscriptionId, {
      ...callbacks,
      context: {
        agentId: context.agentId,
        groupId: context.groupId,
        sessionId: context.sessionId,
        threadId: context.threadId,
        topicId: context.topicId,
      },
      readyCount: 0,
    });
    this.ensureConnected();

    return () => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ subscriptionId, type: 'unsubscribeMessages' }));
      }
      this.subscriptions.delete(subscriptionId);
      if (this.subscriptions.size === 0) this.closeSocket();
    };
  }

  private closeSocket = () => {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    const socket = this.socket;
    this.socket = undefined;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, 'Client idle');
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
        socket.send(
          JSON.stringify({
            context: subscription.context,
            subscriptionId,
            type: 'subscribeMessages',
          }),
        );
      }
    });

    socket.addEventListener('message', (event) => {
      if (this.socket !== socket || typeof event.data !== 'string') return;

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
        subscription.readyCount += 1;
        if (subscription.readyCount > 1) subscription.onReconnect();
      }
    });

    const reconnect = () => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      if (this.subscriptions.size === 0 || document.visibilityState === 'hidden') return;

      const delay = Math.min(30_000, 1000 * 2 ** Math.min(this.reconnectAttempt, 5));
      this.reconnectAttempt += 1;
      this.reconnectTimer = setTimeout(this.ensureConnected, delay);
    };

    socket.addEventListener('close', reconnect);
    socket.addEventListener('error', () => socket.close());
  };

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      this.closeSocket();
      return;
    }
    this.ensureConnected();
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
