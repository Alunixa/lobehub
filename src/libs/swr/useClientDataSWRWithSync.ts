/**
 * useClientDataSWR with automatic Zustand store sync
 *
 * Solves the problem of SWR cached data not being immediately synced to Zustand store.
 * When SWR returns data from the persisted cache, it will automatically sync to store via onData callback.
 *
 * Persistence (localStorage vs IndexedDB) is handled transparently by the
 * tier-aware SWR cache provider (see `localStorageProvider.ts`) based on the
 * SWR key — consumers never need to opt in per call.
 */

import { useEffect, useRef, useState } from 'react';
import { type SWRConfiguration, type SWRResponse, unstable_serialize } from 'swr';

import { useActiveWorkspaceId } from '@/business/client/hooks/useActiveWorkspaceId';

import { augmentKey } from './augmentKey';
import { useClientDataSWR } from './index';
import { buildLocalDataKey, localDataCache } from './localDataCache';
import { SWR_CACHE_VERSION } from './localStorageProvider';
import { useCacheScope } from './useCacheScope';

type Key = string | readonly unknown[] | null | undefined;

interface UseClientDataSWRWithSyncOptions<T> extends SWRConfiguration<T> {
  /**
   * Read this exact key directly from the IndexedDB tier before full-scope
   * hydration finishes. Intended for current-conversation messages where a
   * fast stale snapshot is preferable to a skeleton while HTTP revalidates.
   */
  hydrateFromIndexedDB?: boolean;
  /**
   * Data sync callback, called when data is available (both cached and fresh data)
   * Used to sync data to Zustand store
   */
  onData?: (data: T) => void;
  /**
   * Whether to skip sync (optional, for conditional skipping)
   */
  skipSync?: boolean;
}

/**
 * Enhanced version of useClientDataSWR with automatic cache data sync to Zustand store
 *
 * @example
 * ```ts
 * useClientDataSWRWithSync(
 *   isLogin ? ['fetchAgentList', isLogin] : null,
 *   () => homeService.getSidebarAgentList(),
 *   {
 *     onData: (data) => {
 *       // Auto sync to store, whether cached or fresh data
 *       set({ ...mapResponseToState(data), isInit: true });
 *     },
 *     skipSync: state.isInit, // Optional: skip after initialized
 *   }
 * );
 * ```
 */
export function useClientDataSWRWithSync<T>(
  key: Key,
  fetcher: (() => Promise<T>) | null,
  options?: UseClientDataSWRWithSyncOptions<T>,
): SWRResponse<T> {
  const { hydrateFromIndexedDB, onData, skipSync, onSuccess, ...swrOptions } = options || {};
  const hasSyncedRef = useRef(false);
  const workspaceId = useActiveWorkspaceId();
  const scope = useCacheScope();
  const augmentedKey = augmentKey(key, workspaceId);
  const serializedKey = key ? unstable_serialize(augmentedKey as any) : '';
  const [localHydration, setLocalHydration] = useState<{
    data?: T;
    key: string;
    ready: boolean;
  }>(() => ({ key: serializedKey, ready: !hydrateFromIndexedDB }));
  const isLocalHydrationReady =
    !hydrateFromIndexedDB ||
    !serializedKey ||
    (localHydration.key === serializedKey && localHydration.ready);
  const hydratedData =
    localHydration.key === serializedKey ? localHydration.data : undefined;
  const effectiveKey = isLocalHydrationReady ? key : null;

  const response = useClientDataSWR<T>(effectiveKey, isLocalHydrationReady ? fetcher : null, {
    ...swrOptions,
    ...(hydratedData !== undefined && swrOptions.fallbackData === undefined
      ? { fallbackData: hydratedData }
      : {}),
    onSuccess: (data, key, config) => {
      // Call original onSuccess
      onSuccess?.(data, key, config);
      // Also sync via onData
      if (onData && !skipSync) {
        onData(data);
        hasSyncedRef.current = true;
      }
    },
  });

  useEffect(() => {
    if (!hydrateFromIndexedDB || !serializedKey) return;

    let cancelled = false;
    void (async () => {
      const row = await localDataCache.getEntry<{ data?: T }>(
        buildLocalDataKey(scope, serializedKey),
      );
      if (cancelled) return;

      setLocalHydration({
        data: row?.version === SWR_CACHE_VERSION ? row.data?.data : undefined,
        key: serializedKey,
        ready: true,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    hydrateFromIndexedDB,
    scope,
    serializedKey,
  ]);

  const { data } = response;

  // When cached data is available, sync to store immediately
  useEffect(() => {
    if (data && onData && !skipSync && !hasSyncedRef.current) {
      onData(data);
      hasSyncedRef.current = true;
    }
  }, [data, onData, skipSync]);

  // Reset sync state when key changes
  useEffect(() => {
    hasSyncedRef.current = false;
  }, [serializedKey]);

  return response;
}
