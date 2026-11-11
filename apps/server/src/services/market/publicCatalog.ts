import { MarketAPIError } from '@lobehub/market-sdk';

interface PublicCatalogDetail {
  identifier: string;
  kind: 'agent' | 'mcp' | 'skill';
  locale?: string;
  version?: string;
}

/**
 * Public detail routes accept anonymous readers, but their optional user-auth
 * middleware rejects machine tokens accepted by the catalogue list routes.
 * Only a 401 may fall back, and the fallback sends no caller identity.
 */
export const readMarketCatalogDetail = async <T>(
  authenticatedRead: () => Promise<T>,
  detail: PublicCatalogDetail,
): Promise<T> => {
  try {
    return await authenticatedRead();
  } catch (error) {
    if (!(error instanceof MarketAPIError) || error.status !== 401) throw error;
  }

  const base = process.env.MARKET_BASE_URL || 'https://market.lobehub.com';
  const prefix = { agent: 'agents/detail', mcp: 'plugins', skill: 'skills' }[detail.kind];
  const url = new URL(
    `${base.replace(/\/+$/, '')}/api/v1/${prefix}/${encodeURIComponent(detail.identifier)}`,
  );
  if (detail.locale) url.searchParams.set('locale', detail.locale);
  if (detail.version !== undefined) url.searchParams.set('version', detail.version);

  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new MarketAPIError(response.status, response.statusText);
  }

  return response.json() as Promise<T>;
};
