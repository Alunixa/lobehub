import { observable } from '@trpc/server/observable';
import superjson from 'superjson';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createWSClient: vi.fn(),
  wsLink: vi.fn(),
}));

vi.mock('@trpc/client', () => ({
  createWSClient: mocks.createWSClient,
  wsLink: mocks.wsLink,
}));

import { websocketFirstLink } from './websocketFirstLink';

const makeOperation = (type: 'mutation' | 'query' = 'query') => ({
  context: {},
  id: 1,
  input: undefined,
  path: 'user.getUserState',
  signal: null,
  type,
});

const makeFallback = (value = 'http') =>
  vi.fn(() =>
    observable((observer) => {
      observer.next({ result: { data: value } });
      observer.complete();
    }),
  );

const makeLink = (response: ReturnType<typeof observable>) => {
  const client = { close: vi.fn().mockResolvedValue(undefined) };
  mocks.createWSClient.mockReturnValue(client);
  mocks.wsLink.mockReturnValue(() => () => response);

  return websocketFirstLink({
    responseTimeoutMs: 25,
    transformer: superjson,
    url: 'wss://example.test/api/trpc-ws',
  })({});
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', class WebSocket {});
  vi.stubGlobal('window', {
    addEventListener: vi.fn(),
    location: { host: 'example.test', protocol: 'https:' },
  });
  vi.stubGlobal('document', {
    addEventListener: vi.fn(),
    visibilityState: 'visible',
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('websocketFirstLink', () => {
  it('falls back to HTTP when the WebSocket does not respond in time', async () => {
    const fallback = makeFallback();
    const link = makeLink(observable(() => {}));
    const values: unknown[] = [];

    link({ op: makeOperation(), next: fallback }).subscribe({
      complete: () => values.push('complete'),
      next: (value) => values.push(value.result.data),
    });

    await vi.advanceTimersByTimeAsync(30);

    expect(fallback).toHaveBeenCalledTimes(1);
    expect(values).toEqual(['http', 'complete']);
  });

  it('falls back to HTTP when the WebSocket reports a transport error', () => {
    const fallback = makeFallback();
    const link = makeLink(
      observable((observer) => {
        observer.error(new Error('socket closed'));
      }),
    );
    const values: unknown[] = [];

    link({ op: makeOperation(), next: fallback }).subscribe({
      complete: () => values.push('complete'),
      next: (value) => values.push(value.result.data),
    });

    expect(fallback).toHaveBeenCalledTimes(1);
    expect(values).toEqual(['http', 'complete']);
  });

  it('does not use WebSocket for mutation operations', () => {
    const fallback = makeFallback();
    const websocketResponse = observable(() => {});
    const link = makeLink(websocketResponse);

    link({ op: makeOperation('mutation'), next: fallback }).subscribe({});

    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('keeps a successful WebSocket result on the WebSocket path', () => {
    const fallback = makeFallback();
    const link = makeLink(
      observable((observer) => {
        observer.next({ result: { data: 'websocket' } });
        observer.complete();
      }),
    );
    const values: unknown[] = [];

    link({ op: makeOperation(), next: fallback }).subscribe({
      complete: () => values.push('complete'),
      next: (value) => values.push(value.result.data),
    });

    expect(fallback).not.toHaveBeenCalled();
    expect(values).toEqual(['websocket', 'complete']);
  });
});
