import { AsyncLocalStorage } from 'node:async_hooks';
import { channel } from 'node:diagnostics_channel';
import { performance } from 'node:perf_hooks';

import type { ModelRequestTiming } from '@lobechat/types';
import { isRecord, pickString, toRecord } from '@lobechat/utils/object';

const activeScope = new AsyncLocalStorage<symbol>();
const MODEL_REQUEST_PATH =
  /\/(?:responses|chat\/completions|messages|(?:models\/[^/]+:)?(?:streamGenerateContent|generateContent))(?:\?|$)/;

/**
 * Observe only this attempt's model HTTP requests. No fetch/dispatcher changes,
 * request-body copies, global proxy settings, or retention of credentials/URLs.
 */
export const createLlmRequestTiming = () => {
  const scope = Symbol('llm-request');
  const requests = new WeakMap<object, ModelRequestTiming>();
  const subscriptions: Array<() => void> = [];
  let startedAt = performance.now();
  let requestCount = 0;
  let latest: ModelRequestTiming | undefined;

  const elapsed = () => Math.max(0, Math.round(performance.now() - startedAt));
  const subscribe = (name: string, listener: (message: unknown) => void) => {
    const diagnosticChannel = channel(name);
    diagnosticChannel.subscribe(listener);
    subscriptions.push(() => diagnosticChannel.unsubscribe(listener));
  };
  const getTiming = (message: unknown) => {
    const request = toRecord(message)?.request;
    return isRecord(request) ? requests.get(request) : undefined;
  };

  subscribe('undici:request:create', (message) => {
    if (activeScope.getStore() !== scope) return;
    const request = toRecord(toRecord(message)?.request);
    if (
      !request ||
      request.method !== 'POST' ||
      typeof request.path !== 'string' ||
      !MODEL_REQUEST_PATH.test(request.path)
    )
      return;

    requestCount++;
    latest = {
      phase: 'sending_request',
      requestCount,
      requestCreatedMs: elapsed(),
    };
    if (typeof request.contentLength === 'number' && request.contentLength >= 0) {
      latest.requestBodyBytes = request.contentLength;
    }
    requests.set(request, latest);
  });
  subscribe('undici:client:sendHeaders', (message) => {
    const timing = getTiming(message);
    if (!timing) return;
    // The native fetch dispatcher may add Content-Length after request:create.
    // Extract only its numeric value; never store or log the header block.
    const headers = pickString(toRecord(message)?.headers);
    const length = headers && /(?:^|\r\n)content-length:\s*(\d+)(?:\r\n|$)/i.exec(headers)?.[1];
    if (length !== undefined && length !== '') {
      const bytes = Number(length);
      if (Number.isSafeInteger(bytes) && bytes >= 0) timing.requestBodyBytes = bytes;
    }
  });
  subscribe('undici:request:bodySent', (message) => {
    const timing = getTiming(message);
    if (!timing) return;
    timing.requestBodySentMs = elapsed();
    // An early HTTP error may arrive before the body has finished sending.
    if (timing.responseHeadersMs === undefined) timing.phase = 'awaiting_headers';
  });
  subscribe('undici:request:headers', (message) => {
    const timing = getTiming(message);
    if (!timing) return;
    timing.responseHeadersMs = elapsed();
    timing.phase = 'receiving_response';
    const status = toRecord(toRecord(message)?.response)?.statusCode;
    if (typeof status === 'number') timing.httpStatus = status;
  });
  subscribe('undici:request:bodyChunkReceived', (message) => {
    const timing = getTiming(message);
    if (timing && timing.firstResponseByteMs === undefined) {
      timing.firstResponseByteMs = elapsed();
    }
  });
  subscribe('undici:request:trailers', (message) => {
    const timing = getTiming(message);
    if (!timing) return;
    timing.responseEndedMs = elapsed();
    timing.phase = 'completed';
  });
  subscribe('undici:request:error', (message) => {
    const timing = getTiming(message);
    if (!timing) return;
    timing.transportErrorCode = pickString(toRecord(toRecord(message)?.error)?.code);
  });

  const snapshot = (): ModelRequestTiming | undefined =>
    latest ? { ...latest, requestCount } : undefined;
  const run = <T>(work: () => T): T => {
    startedAt = performance.now();
    return activeScope.run(scope, work);
  };

  return {
    bind:
      <TArgs extends unknown[], TResult>(work: (...args: TArgs) => TResult) =>
      (...args: TArgs): TResult =>
        run(() => work(...args)),
    dispose: () => {
      for (const unsubscribe of subscriptions.splice(0)) unsubscribe();
    },
    enrichError: (error: unknown): unknown => {
      const requestTiming = snapshot();
      if (!requestTiming || !isRecord(error)) return error;
      if (error instanceof Error) {
        if (Object.isExtensible(error)) {
          const responseBody = error._responseBody;
          Object.assign(error, {
            requestTiming,
            ...(responseBody === undefined
              ? {}
              : {
                  _responseBody: {
                    ...(toRecord(responseBody) ?? { error: responseBody }),
                    requestTiming,
                  },
                }),
          });
        }
        return error;
      }
      return {
        ...error,
        error: {
          ...(toRecord(error.error) ?? (error.error === undefined ? {} : { error: error.error })),
          requestTiming,
        },
      };
    },
    run,
    snapshot,
  };
};
