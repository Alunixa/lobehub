import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { createBridgeError, toWebSocketResponse } = require('./realtimeServer.js');

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
