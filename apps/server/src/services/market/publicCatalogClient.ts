import { CURRENT_VERSION } from '@lobechat/const';
import { MarketAPIError, MarketSDK } from '@lobehub/market-sdk';

let publicClient: { baseURL: string; expiresAt: number; promise: Promise<MarketSDK> } | undefined;
let registration:
  { baseURL: string; promise: Promise<{ client_id: string; client_secret: string }> } | undefined;

const getPublicClient = () => {
  const baseURL = process.env.MARKET_BASE_URL || 'https://market.lobehub.com';
  if (publicClient?.baseURL === baseURL && Date.now() < publicClient.expiresAt)
    return publicClient.promise;

  if (registration?.baseURL !== baseURL) {
    const promise = new MarketSDK({ baseURL }).registerClient({
      clientName: 'LobeHub Public Catalogue',
      clientType: 'web',
      deviceId: 'self-hosted-public-catalogue',
      version: CURRENT_VERSION,
    });
    registration = { baseURL, promise };
  }
  const currentRegistration = registration;
  let expiresAt = Infinity;

  const promise = (async () => {
    const credentials = await currentRegistration.promise;
    const auth = new MarketSDK({
      baseURL,
      clientId: credentials.client_id,
      clientSecret: credentials.client_secret,
    });
    const token = await auth.fetchM2MToken();
    if (!token.accessToken) throw new Error('Public catalogue token unavailable');
    expiresAt = Date.now() + Math.max(0, token.expiresIn - 60) * 1000;

    // Never attach a user's identity, workspace, cookies or saved credentials.
    return new MarketSDK({ accessToken: token.accessToken, baseURL });
  })();

  const entry = {
    baseURL,
    get expiresAt() {
      return expiresAt;
    },
    promise,
  };
  publicClient = entry;
  void promise.catch((error: unknown) => {
    if (publicClient === entry) publicClient = undefined;
    if (registration === currentRegistration) registration = undefined;
    console.error('Public catalogue registration failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
  });
  return promise;
};

/**
 * Only use for published, public catalogue reads. Private resource operations
 * and writes must keep the original caller's authentication and permissions.
 */
export const readMarketCatalog = async <T>(
  market: MarketSDK,
  read: (client: MarketSDK) => Promise<T>,
): Promise<T> => {
  try {
    return await read(market);
  } catch (error) {
    if (!(error instanceof MarketAPIError) || error.status !== 401) throw error;
  }

  for (let attempt = 0; ; attempt++) {
    const client = await getPublicClient();
    try {
      return await read(client);
    } catch (error) {
      if (!(error instanceof MarketAPIError) || error.status !== 401) throw error;
      // A token revoked before its expiry gets one bounded refresh, not a loop.
      if (publicClient && (await publicClient.promise) === client) publicClient = undefined;
      if (attempt >= 1) throw error;
    }
  }
};
