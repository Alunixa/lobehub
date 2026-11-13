import { MarketAPIError } from '@lobehub/market-sdk';
import { TRPCError } from '@trpc/server';
import { describe, expect, it } from 'vitest';

import { mapMarketError } from './marketError';

describe('mapMarketError', () => {
  it('preserves rate limits so clients can avoid tight retry loops', () => {
    const error = mapMarketError(new MarketAPIError(429, 'Too Many Requests'), 'Market failed');

    expect(error.code).toBe('TOO_MANY_REQUESTS');
    expect(error.message).toBe('Too Many Requests');
  });

  it('does not route a rejected Market credential to app re-authentication', () => {
    const error = mapMarketError(new MarketAPIError(401, 'Unauthorized'), 'Market failed');

    expect(error.code).toBe('BAD_GATEWAY');
  });

  it('keeps existing tRPC error codes', () => {
    const original = new TRPCError({ code: 'NOT_FOUND', message: 'Missing resource' });

    expect(mapMarketError(original, 'Market failed')).toBe(original);
  });
});
