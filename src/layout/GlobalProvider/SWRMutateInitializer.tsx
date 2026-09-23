'use client';

import { type PropsWithChildren, useEffect, useRef } from 'react';
import { useSWRConfig } from 'swr';

import { cacheHydration } from '@/libs/swr/cacheHydration';
import { setScopedMutate } from '@/libs/swr/mutate';
import { useCacheScope } from '@/libs/swr/useCacheScope';

/**
 * Initialize scoped mutate for use outside React components (e.g., Zustand stores)
 * This component must be rendered inside SWRConfig to access the scoped mutate
 */
const SWRMutateInitializer = ({ children }: PropsWithChildren) => {
  const { mutate } = useSWRConfig();
  const scope = useCacheScope();
  const lastRevalidatedScope = useRef<string | null>(null);

  useEffect(() => {
    setScopedMutate(mutate);

    const revalidateHydratedScope = () => {
      if (!cacheHydration.isReady(scope) || lastRevalidatedScope.current === scope) return;

      lastRevalidatedScope.current = scope;
      void mutate(() => true, undefined, { revalidate: true }).catch((error) => {
        console.error('[SWR Cache] failed to revalidate hydrated scope', error);
      });
    };

    revalidateHydratedScope();
    return cacheHydration.subscribe(revalidateHydratedScope);
  }, [mutate, scope]);

  return <>{children}</>;
};

export default SWRMutateInitializer;
