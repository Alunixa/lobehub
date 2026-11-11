// @vitest-environment node
import { MarketAPIError } from '@lobehub/market-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readMarketCatalogDetail } from './publicCatalog';

describe('readMarketCatalogDetail', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('preserves authenticated and private detail responses', async () => {
    const detail = { identifier: 'private-agent', private: true };
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(
      readMarketCatalogDetail(async () => detail, { identifier: 'private-agent', kind: 'agent' }),
    ).resolves.toBe(detail);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(['agent', 'mcp', 'skill'] as const)(
    'reads the public %s detail without forwarding a rejected machine token',
    async (kind) => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(Response.json({ identifier: 'public-resource', content: 'available' }));
      const result = await readMarketCatalogDetail(
        async () => {
          throw new MarketAPIError(401, 'invalid_token');
        },
        { identifier: 'public-resource', kind, locale: 'zh-CN' },
      );
      expect(result).toEqual({ identifier: 'public-resource', content: 'available' });
      const [url, options] = fetchSpy.mock.calls[0];
      const parsed = new URL(String(url));
      expect(parsed.hostname).toBe('market.lobehub.com');
      expect(parsed.searchParams.get('locale')).toBe('zh-CN');
      expect(options?.headers).toBeUndefined();
      expect(options?.redirect).toBe('error');
    },
  );

  it('respects the configured server URL and encodes resource identifiers', async () => {
    vi.stubEnv('MARKET_BASE_URL', 'https://market.example.test/prefix/');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({}));
    await readMarketCatalogDetail(
      async () => {
        throw new MarketAPIError(401, 'invalid_token');
      },
      { identifier: 'owner/repo?token=not-a-credential', kind: 'skill', version: '1.2.3' },
    );
    const url = new URL(String(fetchSpy.mock.calls[0][0]));
    expect(url.origin).toBe('https://market.example.test');
    expect(url.pathname).toBe('/prefix/api/v1/skills/owner%2Frepo%3Ftoken%3Dnot-a-credential');
    expect([...url.searchParams.keys()]).toEqual(['version']);
  });

  it.each([403, 404, 429, 500])('does not bypass or retry an upstream %s', async (status) => {
    const error = new MarketAPIError(status, 'Original error');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(
      readMarketCatalogDetail(
        async () => {
          throw error;
        },
        { identifier: 'resource', kind: 'skill' },
      ),
    ).rejects.toBe(error);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not expose a resource that is unavailable to anonymous readers', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }));
    await expect(
      readMarketCatalogDetail(
        async () => {
          throw new MarketAPIError(401, 'invalid_token');
        },
        { identifier: 'private-resource', kind: 'skill' },
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
