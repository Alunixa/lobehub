// @vitest-environment node
import { MarketAPIError, MarketSDK } from '@lobehub/market-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const page = { currentPage: 1, items: [{ identifier: 'public' }], totalCount: 1, totalPages: 1 };
let testId = 0;

describe('public catalogue authentication recovery', () => {
  beforeEach(() => {
    vi.stubEnv('MARKET_BASE_URL', `https://catalogue-${++testId}.example.test`);
    vi.stubEnv('MARKET_API_KEY', '');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  const setup = async () => {
    const requests: { auth: string | null; pathname: string; search: string }[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, options) => {
      const url = new URL(String(input));
      const auth = new Headers(options?.headers).get('authorization');
      requests.push({ auth, pathname: url.pathname, search: url.search });
      if (url.pathname === '/api/v1/clients/register') {
        expect(auth).toBeNull();
        return Response.json({ client_id: 'machine-id', client_secret: 'machine-fixture' });
      }
      if (url.pathname === '/oauth/token') {
        return Response.json({ access_token: 'public-machine-token', expires_in: 3600 });
      }
      if (auth !== 'Bearer public-machine-token') {
        return Response.json({ error: 'invalid_token' }, { status: 401 });
      }
      return Response.json(page);
    });
    const { readMarketCatalog } = await import('./publicCatalogClient');
    return { readMarketCatalog, requests };
  };

  it.each([undefined, 'expired-user-token'])(
    'recovers catalogue reads with missing or expired credentials (%s)',
    async (accessToken) => {
      const { readMarketCatalog, requests } = await setup();
      const market = new MarketSDK({ accessToken });
      await expect(
        readMarketCatalog(market, (client) =>
          client.plugins.getPluginList({ locale: 'zh-CN', page: 3, pageSize: 2, q: 'search' }),
        ),
      ).resolves.toEqual(page);
      const recovered = requests.at(-1)!;
      expect(recovered.auth).toBe('Bearer public-machine-token');
      expect(new URLSearchParams(recovered.search).get('page')).toBe('3');
      expect(new URLSearchParams(recovered.search).get('q')).toBe('search');
      expect(requests.filter((r) => r.pathname === '/api/v1/clients/register')).toHaveLength(1);
    },
  );

  it('single-flights registration and token exchange across all three public catalogues', async () => {
    const { readMarketCatalog, requests } = await setup();
    const market = new MarketSDK({ accessToken: 'expired' });
    const results = await Promise.all([
      readMarketCatalog(market, (client) => client.agents.getAgentList()),
      readMarketCatalog(market, (client) => client.plugins.getPluginList()),
      readMarketCatalog(market, (client) => client.marketSkills.getSkillList()),
    ]);
    expect(results).toEqual([page, page, page]);
    expect(requests.filter((r) => r.pathname === '/api/v1/clients/register')).toHaveLength(1);
    expect(requests.filter((r) => r.pathname === '/oauth/token')).toHaveLength(1);
  });

  it('preserves successful user-scoped results without creating another identity', async () => {
    const { readMarketCatalog, requests } = await setup();
    const market = new MarketSDK({ accessToken: 'valid-user-token' });
    const read = vi.fn(async () => ({ private: true }));
    await expect(readMarketCatalog(market, read)).resolves.toEqual({ private: true });
    expect(requests).toHaveLength(0);
    expect(read).toHaveBeenCalledOnce();
  });

  it.each([403, 404, 429, 500])('does not recover or retry an upstream %s', async (status) => {
    const { readMarketCatalog, requests } = await setup();
    const error = new MarketAPIError(status, 'original');
    await expect(
      readMarketCatalog(new MarketSDK(), async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(requests).toHaveLength(0);
  });

  it('never forwards the rejected user credential to machine registration or exchange', async () => {
    const { readMarketCatalog, requests } = await setup();
    await readMarketCatalog(new MarketSDK({ accessToken: 'private-user-credential' }), (client) =>
      client.plugins.getPluginList(),
    );
    expect(requests.slice(1).every((r) => r.auth !== 'Bearer private-user-credential')).toBe(true);
  });

  it('refreshes an expired token without repeatedly registering the server', async () => {
    const { readMarketCatalog, requests } = await setup();
    const market = new MarketSDK();
    const read = (client: MarketSDK) => client.plugins.getPluginList();
    await readMarketCatalog(market, read);
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 3600_000);
    await readMarketCatalog(market, read);
    expect(requests.filter((r) => r.pathname === '/api/v1/clients/register')).toHaveLength(1);
    expect(requests.filter((r) => r.pathname === '/oauth/token')).toHaveLength(2);
  });

  it('does not spin when the public machine credential is also rejected', async () => {
    const { readMarketCatalog, requests } = await setup();
    const read = vi.fn(async () => {
      throw new MarketAPIError(401, 'rejected');
    });
    await expect(readMarketCatalog(new MarketSDK(), read)).rejects.toMatchObject({ status: 401 });
    expect(read).toHaveBeenCalledTimes(3);
    expect(requests.filter((r) => r.pathname === '/api/v1/clients/register')).toHaveLength(1);
  });
});
