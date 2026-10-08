import type {
  AgentStreamClientOptions,
  AgentStreamEvent,
  ConnectionStatus,
} from '@lobechat/agent-gateway-client';
import { AgentStreamClient } from '@lobechat/agent-gateway-client';
import { CLOSE_EVENT_SOURCE, fetchEventSource } from '@lobechat/utils/client';

import { getBusinessTrpcHeaders } from '@/business/client/trpc-headers';
import { createHeaderWithAuth } from '@/services/_auth';
import { aiAgentService } from '@/services/aiAgent';

/**
 * Same event contract as the Gateway, using the self-hosted server's SSE bus.
 * Disconnecting a viewer never cancels the server producer. Reconnect resumes
 * after a concrete Redis cursor rather than submitting the prompt again.
 */
export class ServerAgentStreamClient extends AgentStreamClient {
  private controller?: AbortController;
  private cursor = '0';
  private stopped = true;
  private terminal = false;
  private status: ConnectionStatus = 'disconnected';
  private retryTimer?: ReturnType<typeof setTimeout>;
  private retryDelay = 1000;
  private readonly serverOperationId: string;

  constructor(options: AgentStreamClientOptions) {
    super(options);
    this.serverOperationId = options.operationId;
  }

  override get connectionStatus() {
    return this.status;
  }

  override connect() {
    if (!this.stopped) return;
    this.stopped = false;
    this.terminal = false;
    window.addEventListener('online', this.wake);
    document.addEventListener('visibilitychange', this.wake);
    void this.open();
  }

  override disconnect() {
    this.stopped = true;
    this.controller?.abort();
    clearTimeout(this.retryTimer);
    window.removeEventListener('online', this.wake);
    document.removeEventListener('visibilitychange', this.wake);
    this.setConnectionStatus('disconnected');
  }

  override sendInterrupt() {
    void aiAgentService.interruptTask({ operationId: this.serverOperationId }).catch((error) => {
      this.emit('error', error);
    });
  }

  override async reconnect() {
    this.controller?.abort();
    clearTimeout(this.retryTimer);
    if (!this.stopped && !this.terminal) await this.open();
  }

  private readonly wake = () => {
    if (document.visibilityState === 'hidden' || this.stopped || this.terminal) return;
    if (this.status === 'reconnecting') void this.reconnect();
  };

  private setConnectionStatus(status: ConnectionStatus) {
    this.status = status;
    this.emit('status_changed', status);
  }

  private async open() {
    if (this.stopped || this.terminal) return;
    const controller = new AbortController();
    this.controller = controller;
    this.setConnectionStatus('connecting');
    try {
      const headers = new Headers(await createHeaderWithAuth());
      for (const [name, value] of Object.entries(await getBusinessTrpcHeaders())) {
        headers.set(name, value);
      }
      if (controller.signal.aborted) return;
      const params = new URLSearchParams({
        lastEventId: this.cursor,
        operationId: this.serverOperationId,
      });
      await fetchEventSource(`/api/agent/stream?${params}`, {
        headers: { ...Object.fromEntries(headers.entries()), 'Last-Event-ID': this.cursor },
        onopen: async (response) => {
          if (!response.ok) {
            if ([401, 403, 404].includes(response.status)) {
              this.terminal = true;
              this.emit('auth_failed', `Server operation stream: HTTP ${response.status}`);
            }
            throw new Error(`Server stream: HTTP ${response.status}`);
          }
          this.retryDelay = 1000;
          this.setConnectionStatus('connected');
          this.emit('connected');
        },
        onmessage: (message) => {
          if (!message.data || ['connected', 'heartbeat'].includes(message.event)) return;
          const event = JSON.parse(message.data) as AgentStreamEvent;
          if (event.id) this.cursor = event.id;
          else if (message.id && /^\d+-\d+$/.test(message.id)) this.cursor = message.id;
          this.emit('agent_event', event);
          if (
            event.operationId === this.serverOperationId &&
            ['agent_runtime_end', 'error'].includes(event.type)
          ) {
            this.terminal = true;
            this.emit('session_complete');
            this.disconnect();
            return CLOSE_EVENT_SOURCE;
          }
        },
        onerror: (error) => {
          if (!controller.signal.aborted && !this.terminal) this.emit('error', error);
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (!controller.signal.aborted && !this.terminal) this.emit('error', error);
    } finally {
      // An older, intentionally aborted connection must not overwrite its replacement.
      if (this.controller === controller && !this.stopped && !this.terminal) {
        this.setConnectionStatus('reconnecting');
        this.emit('reconnecting', this.retryDelay);
        this.retryTimer = setTimeout(() => void this.open(), this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 2, 15_000);
      }
    }
  }
}
