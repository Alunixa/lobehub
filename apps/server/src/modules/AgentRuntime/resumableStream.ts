import { formatSSEEvent } from '@lobechat/utils/server';

import type { IStreamEventManager } from './types';

const TERMINAL_STATUSES = new Set([
  'done',
  'error',
  'interrupted',
  'cancelled',
  'waiting_for_human',
  'waiting_for_async_tool',
  'human_approve_required',
]);

/**
 * A viewer-owned subscription to a producer-owned operation.
 * A dropped subscriber only ends its own read loop, never the model request.
 */
export const createResumableAgentStream = ({
  getStatus,
  lastEventId,
  manager,
  operationId,
  signal,
}: {
  getStatus: () => Promise<string | { error?: unknown; status: string } | undefined>;
  lastEventId: string;
  manager: Pick<IStreamEventManager, 'closeReadConnection' | 'readEventsOnce'>;
  operationId: string;
  signal?: AbortSignal;
}) => {
  const encoder = new TextEncoder();
  let stopped = false;
  let wake: (() => void) | undefined;
  const cleanup = () => {
    stopped = true;
    wake?.();
    signal?.removeEventListener('abort', cleanup);
  };
  const pause = () =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 250);
      wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  return new ReadableStream<Uint8Array>({
    cancel: cleanup,
    async start(controller) {
      let cursor = lastEventId;
      let heartbeatAt = Date.now();
      let checkedStatusAt = 0;
      const startedAt = Date.now();
      const write = (value: string) => {
        if (!stopped) controller.enqueue(encoder.encode(value));
      };
      signal?.addEventListener('abort', cleanup, { once: true });
      if (signal?.aborted) cleanup();
      try {
        write(
          formatSSEEvent({
            data: { operationId, type: 'connected' },
            event: 'connected',
          }),
        );
        while (!stopped && Date.now() - startedAt < 50_000) {
          // One replay+live cursor, not overlapping history and subscription loops.
          const result = await manager.readEventsOnce(operationId, cursor, 1000);
          cursor = result.lastEventId;
          for (const event of result.events) {
            if (stopped) break;
            write(formatSSEEvent({ data: event, event: event.type, id: event.id }));
            if (event.operationId === operationId && event.type === 'agent_runtime_end') return;
          }
          const now = Date.now();
          if (result.events.length === 0 && now - checkedStatusAt >= 5000) {
            checkedStatusAt = now;
            const persisted = await getStatus();
            const status = typeof persisted === 'string' ? persisted : persisted?.status;
            if (status && TERMINAL_STATUSES.has(status)) {
              // DB is authoritative if the terminal event expired/was trimmed.
              write(
                formatSSEEvent({
                  data: {
                    data: {
                      reason: status,
                      ...(typeof persisted === 'object' && persisted.error
                        ? { error: persisted.error }
                        : {}),
                    },
                    operationId,
                    type: 'agent_runtime_end',
                  },
                  event: 'agent_runtime_end',
                }),
              );
              return;
            }
          }
          if (now - heartbeatAt >= 15_000) {
            write(': keepalive\n\n');
            heartbeatAt = now;
          }
          if (result.events.length === 0) await pause();
        }
      } catch (error) {
        if (!stopped) console.error('[AgentStream] Subscription failed:', error);
      } finally {
        cleanup();
        await manager.closeReadConnection?.();
        try {
          controller.close();
        } catch {
          /* Reader already cancelled. */
        }
      }
    },
  });
};
