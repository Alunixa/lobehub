import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { createBridgeError, createRedisMessageBroker, toWebSocketResponse } =
  require('./realtimeServer.js');

describe('realtime tRPC bridge envelopes', () => {
  it('converts an HTTP success envelope into a WebSocket data envelope', () => {
    expect(
      toWebSocketResponse(
        17,
        {
          result: {
            data: {
              userId: 'user-1',
            },
          },
        },
        200,
      ),
    ).toEqual({
      id: 17,
      result: {
        data: {
          userId: 'user-1',
        },
        type: 'data',
      },
    });
  });

  it('preserves a valid upstream tRPC error envelope', () => {
    const error = {
      code: -32001,
      data: {
        code: 'UNAUTHORIZED',
        httpStatus: 401,
      },
      message: 'Not authorized',
    };

    expect(toWebSocketResponse('request-1', { error }, 401)).toEqual({
      error,
      id: 'request-1',
    });
  });

  it('normalizes the HTTP tRPC error envelope used by unauthorized queries', () => {
    const error = {
      code: -32001,
      data: {
        code: 'UNAUTHORIZED',
        httpStatus: 401,
        path: 'user.getUserState',
      },
      message: 'UNAUTHORIZED',
    };

    expect(toWebSocketResponse('request-http-error', { error: { json: error } }, 401)).toEqual({
      error,
      id: 'request-http-error',
    });
  });

  it('returns a marked standard tRPC error for invalid bridge responses', () => {
    const response = toWebSocketResponse(3, { result: { unexpected: true } }, 502);
    const expected = createBridgeError(
      3,
      undefined,
      'Internal tRPC result response was invalid (502)',
      'INTERNAL_SERVER_ERROR',
      502,
    );

    expect(response).toEqual(expected);
    expect(response.error).toEqual(
      expect.objectContaining({
        code: -32603,
        data: expect.objectContaining({
          httpStatus: 502,
          source: 'realtime-bridge',
        }),
      }),
    );
    expect(response.error.json).toBeUndefined();
  });
});

describe('Redis message broker', () => {
  it('shares one Redis subscription and releases it after the last listener', async () => {
    class FakeRedis extends EventEmitter {
      status = 'wait';
      connect = vi.fn(async () => {
        this.status = 'ready';
      });
      disconnect = vi.fn(() => {
        this.status = 'end';
      });
      quit = vi.fn(async () => {
        this.status = 'end';
      });
      subscribe = vi.fn(async () => {});
      unsubscribe = vi.fn(async () => {});
    }

    const instances = [];
    const RedisClass = class extends FakeRedis {
      constructor() {
        super();
        instances.push(this);
      }
    };
    const broker = createRedisMessageBroker({ RedisClass, redisUrl: 'redis://test' });
    const first = vi.fn();
    const second = vi.fn();
    const [disposeFirst, disposeSecond] = await Promise.all([
      broker.subscribe('channel-1', first),
      broker.subscribe('channel-1', second),
    ]);
    const redis = instances[0];

    expect(redis.connect).toHaveBeenCalledTimes(1);
    expect(redis.subscribe).toHaveBeenCalledTimes(1);
    redis.emit('message', 'channel-1', 'payload');
    expect(first).toHaveBeenCalledWith('payload');
    expect(second).toHaveBeenCalledWith('payload');

    await disposeFirst();
    expect(redis.unsubscribe).not.toHaveBeenCalled();
    await disposeSecond();
    expect(redis.unsubscribe).toHaveBeenCalledWith('channel-1');
    await broker.close();
  });
});
