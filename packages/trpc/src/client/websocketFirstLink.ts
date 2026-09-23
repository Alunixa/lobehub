import { createWSClient, isTRPCClientError, wsLink } from '@trpc/client';
import type { TRPCLink } from '@trpc/client';
import { observable } from '@trpc/server/observable';
import type { AnyRouter, DataTransformerOptions } from '@trpc/server/unstable-core-do-not-import';

const DEFAULT_CONNECTION_TIMEOUT_MS = 900;
const DEFAULT_FAILURE_COOLDOWN_MS = 10_000;
const DEFAULT_IDLE_CLOSE_MS = 30_000;
const REALTIME_BRIDGE_ERROR_SOURCE = 'realtime-bridge';

interface WebsocketFirstLinkOptions {
  enabled?: boolean;
  failureCooldownMs?: number;
  idleCloseMs?: number;
  responseTimeoutMs?: number;
  transformer: DataTransformerOptions;
  url: string | (() => string);
}

const canUseBrowserWebSocket = (): boolean => {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return false;

  return window.location.protocol === 'http:' || window.location.protocol === 'https:';
};

const isRealtimeBridgeError = (error: unknown): boolean => {
  if (!isTRPCClientError(error) || !error.data || typeof error.data !== 'object') {
    return false;
  }

  return (
    'source' in error.data &&
    error.data.source === REALTIME_BRIDGE_ERROR_SOURCE
  );
};

const isApplicationError = (error: unknown): boolean =>
  isTRPCClientError(error) && error.data !== undefined && error.data !== null;

/**
 * Use the native tRPC WebSocket protocol for idempotent query operations, but
 * never let a broken upgrade path hold the request hostage. Mutations and all
 * non-browser runtimes continue through the next link unchanged.
 */
export const websocketFirstLink = <TRouter extends AnyRouter>(
  options: WebsocketFirstLinkOptions,
): TRPCLink<TRouter> => {
  const {
    enabled = true,
    failureCooldownMs = DEFAULT_FAILURE_COOLDOWN_MS,
    idleCloseMs = DEFAULT_IDLE_CLOSE_MS,
    responseTimeoutMs = DEFAULT_CONNECTION_TIMEOUT_MS,
    transformer,
    url,
  } = options;

  if (!enabled || !canUseBrowserWebSocket()) {
    return () => ({ next, op }) => next(op);
  }

  const client = createWSClient({
    lazy: {
      closeMs: idleCloseMs,
      enabled: true,
    },
    retryDelayMs: () => 30_000,
    url,
  });
  const transport = wsLink<TRouter>({
    client,
    transformer,
  })({});

  let disabledUntil = 0;

  const closeClient = () => {
    void client.close();
  };

  const disableUntilCooldownExpires = () => {
    disabledUntil = Date.now() + failureCooldownMs;
    closeClient();
  };

  const closeWhenHidden = () => {
    if (document.visibilityState === 'hidden') {
      disabledUntil = 0;
      closeClient();
    }
  };

  document.addEventListener('visibilitychange', closeWhenHidden);
  window.addEventListener('pagehide', closeClient);

  return () => ({ next, op }) => {
    if (op.type !== 'query' || Date.now() < disabledUntil) return next(op);

    return observable((observer) => {
      let active = true;
      let fallbackStarted = false;
      let responseReceived = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let websocketSubscription: { unsubscribe: () => void } | undefined;
      let fallbackSubscription: { unsubscribe: () => void } | undefined;

      const clearTimeoutIfNeeded = () => {
        if (timeout) {
          clearTimeout(timeout);
          timeout = undefined;
        }
      };

      const switchToHttp = () => {
        if (!active || fallbackStarted) return;

        fallbackStarted = true;
        clearTimeoutIfNeeded();
        websocketSubscription?.unsubscribe();
        disableUntilCooldownExpires();

        try {
          fallbackSubscription = next(op).subscribe({
            complete: () => observer.complete(),
            error: (error) => observer.error(error),
            next: (value) => observer.next(value),
          });
        } catch (error) {
          observer.error(error);
        }
      };

      timeout = setTimeout(switchToHttp, responseTimeoutMs);

      try {
        websocketSubscription = transport({ next, op }).subscribe({
          complete: () => {
            if (!active || fallbackStarted) return;
            clearTimeoutIfNeeded();
            if (responseReceived) observer.complete();
            else switchToHttp();
          },
          error: (error) => {
            if (!active || fallbackStarted) return;
            if (responseReceived || (isApplicationError(error) && !isRealtimeBridgeError(error))) {
              clearTimeoutIfNeeded();
              observer.error(error);
            } else {
              switchToHttp();
            }
          },
          next: (value) => {
            if (!active || fallbackStarted) return;
            responseReceived = true;
            disabledUntil = 0;
            clearTimeoutIfNeeded();
            observer.next(value);
          },
        });
      } catch {
        switchToHttp();
      }

      return () => {
        active = false;
        clearTimeoutIfNeeded();
        websocketSubscription?.unsubscribe();
        fallbackSubscription?.unsubscribe();
      };
    });
  };
};
