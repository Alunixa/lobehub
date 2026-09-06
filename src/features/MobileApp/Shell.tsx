'use client';

import { Flexbox } from '@lobehub/ui';
import { Suspense } from 'react';
import { Outlet } from 'react-router';

import WorkspaceContextSlot from '@/business/client/WorkspaceContextSlot';
import Loading from '@/components/Loading/BrandTextLoading';
import { RouteMetaBridge } from '@/features/RouteMeta';
import dynamic from '@/libs/next/dynamic';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

import { MobileNavigation } from './Navigation';
import { mobileStyles as styles } from './styles';
import { useMobileViewport } from './useMobileViewport';

const CloudBanner = dynamic(() => import('@/features/AlertBanner/CloudBanner'));

export const MobileAppShell = () => {
  const { showCloudPromotion } = useServerConfigStore(featureFlagsSelectors);
  const ref = useMobileViewport();

  return (
    <WorkspaceContextSlot>
      <RouteMetaBridge />
      <Flexbox data-mobile-shell className={styles.shell} ref={ref}>
        <Suspense fallback={null}>{showCloudPromotion && <CloudBanner mobile />}</Suspense>
        <Flexbox className={styles.viewport}>
          <Suspense fallback={<Loading debugId={'MobileAppShell > Outlet'} />}>
            <Outlet />
          </Suspense>
        </Flexbox>
        <MobileNavigation />
      </Flexbox>
    </WorkspaceContextSlot>
  );
};
