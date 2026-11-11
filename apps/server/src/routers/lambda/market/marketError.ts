import { MarketAPIError } from '@lobehub/market-sdk';
import { TRPCError } from '@trpc/server';

const MARKET_STATUS_TO_TRPC_CODE: Record<number, TRPCError['code']> = {
  400: 'BAD_REQUEST',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  429: 'TOO_MANY_REQUESTS',
};

export const mapMarketError = (error: unknown, fallbackMessage: string): TRPCError => {
  if (error instanceof TRPCError) return error;

  if (error instanceof MarketAPIError) {
    return new TRPCError({
      cause: error,
      code: MARKET_STATUS_TO_TRPC_CODE[error.status] ?? 'INTERNAL_SERVER_ERROR',
      message: error.message || fallbackMessage,
    });
  }

  return new TRPCError({
    cause: error,
    code: 'INTERNAL_SERVER_ERROR',
    message: fallbackMessage,
  });
};
