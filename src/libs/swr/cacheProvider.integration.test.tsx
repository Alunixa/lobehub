/**
 * @vitest-environment happy-dom
 *
 * End-to-end test of the local-first chain through real SWR:
 *   fetch → provider write-through to IndexedDB → "reload" (fresh provider) →
 *   synchronous local-first read before the network resolves.
 */
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { createElement } from 'react';
import useSWR, { type Cache, SWRConfig, unstable_serialize } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildLocalDataKey, localDataCache } from './localDataCache';
import { createCacheProvider, SWR_CACHE_VERSION } from './localStorageProvider';
import { useClientDataSWRWithSync } from './useClientDataSWRWithSync';

const SCOPE = 'integration-scope';

const makeProvider = () => {
  let resolveHydrated: () => void;
  const hydrated = new Promise<void>((r) => {
    resolveHydrated = r;
  });
  const provider = createCacheProvider({
    debounceMs: 5,
    getScope: () => SCOPE,
    idbPatterns: ['MSGS'],
    localPatterns: [],
    onScopeHydrated: () => resolveHydrated(),
  });
  return { hydrated, provider };
};

const wrapper =
  (provider: ReturnType<typeof createCacheProvider>) =>
  ({ children }: PropsWithChildren) =>
    createElement(
      SWRConfig,
      { value: { provider: provider as unknown as (c: Readonly<Cache>) => Cache } },
      children,
    );

describe('local-first cache chain (SWR + tiered provider + IndexedDB)', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await localDataCache.clearScope(SCOPE);
    await localDataCache.clearScope('anon:personal');
  });

  it('persists fetched data to IndexedDB and serves it locally on reload', async () => {
    const key = ['MSGS', 'topic-1'];
    const serverV1 = [{ id: 'm1', text: 'first load' }];

    // --- session 1: fetch, which the provider writes through to IndexedDB ---
    const { provider: p1 } = makeProvider();
    const fetcher1 = () => Promise.resolve(serverV1);
    const r1 = renderHook(() => useSWR(key, fetcher1), { wrapper: wrapper(p1) });

    await waitFor(() => expect(r1.result.current.data).toEqual(serverV1));
    // write-through to the IndexedDB tier (debounced)
    await waitFor(async () => {
      const rows = await localDataCache.entriesByScope(SCOPE);
      expect(rows.length).toBeGreaterThan(0);
    });
    r1.unmount();

    // --- session 2 ("reload"): fresh provider hydrates IndexedDB ------------
    // Model SPA bootstrap: hydrate the app-level provider before the consuming
    // React tree mounts. SWR then receives the already-hydrated provider Map.
    const { provider: p2 } = makeProvider();
    await p2.hydrateScope?.();

    // a slow network so the local snapshot must win the first paint
    let resolveSlow: (v: unknown) => void;
    const slow = new Promise((r) => {
      resolveSlow = r;
    });
    const fetcher2 = () => slow;
    const r2 = renderHook(() => useSWR(key, fetcher2), { wrapper: wrapper(p2) });

    // local-first: data is available synchronously from the hydrated cache,
    // before the slow fetch resolves
    expect(r2.result.current.data).toEqual(serverV1);

    // then the fresh server value still flows through
    const serverV2 = [{ id: 'm1', text: 'revalidated' }];
    resolveSlow!(serverV2);
    await waitFor(() => expect(r2.result.current.data).toEqual(serverV2));
  });

  it('hydrates the active message key before full-scope IndexedDB scanning finishes', async () => {
    const scope = 'anon:personal';
    const key = ['message:list', { agentId: 'agent-1', topicId: 'topic-1' }, 1] as const;
    const serializedKey = unstable_serialize(key);
    const cachedMessages = [{ id: 'cached-message', text: 'cached' }];
    await localDataCache.set(
      buildLocalDataKey(scope, serializedKey),
      { data: cachedMessages },
      SWR_CACHE_VERSION,
    );

    let releaseFullHydration: (value: []) => void;
    const blockedFullHydration = new Promise<[]>((resolve) => {
      releaseFullHydration = resolve;
    });
    vi.spyOn(localDataCache, 'entriesByScope').mockReturnValue(blockedFullHydration);

    const provider = createCacheProvider({
      getScope: () => scope,
      idbPatterns: ['message:'],
      localPatterns: [],
    });
    let resolveNetwork: (value: unknown) => void;
    const network = new Promise((resolve) => {
      resolveNetwork = resolve;
    });
    const onData = vi.fn();
    const result = renderHook(
      () =>
        useClientDataSWRWithSync(key, () => network as Promise<any>, {
          hydrateFromIndexedDB: true,
          onData,
        }),
      { wrapper: wrapper(provider) },
    );

    await waitFor(() => expect(result.result.current.data).toEqual(cachedMessages));
    expect(onData).toHaveBeenCalledWith(cachedMessages);

    const networkMessages = [{ id: 'network-message', text: 'fresh' }];
    resolveNetwork!(networkMessages);
    await waitFor(() => expect(result.result.current.data).toEqual(networkMessages));

    releaseFullHydration!([]);
    result.unmount();
  });
});
