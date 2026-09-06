'use client';

import { Flexbox } from '@lobehub/ui';
import { Outlet, useParams } from 'react-router';

import { mobileStyles } from '@/features/MobileApp/styles';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';

import ProviderMenu from '../../../../(main)/settings/provider/ProviderMenu';

const Layout = () => {
  const params = useParams<{ providerId: string }>();
  const navigate = useWorkspaceAwareNavigate();

  const handleProviderSelect = (providerKey: string) => {
    navigate(`/settings/provider/${providerKey}`, { escape: true });
  };

  return (
    <Flexbox className={mobileStyles.settings} style={{ minWidth: 0 }}>
      {params.providerId === 'all' ? (
        <ProviderMenu mobile onProviderSelect={handleProviderSelect} />
      ) : (
        <Flexbox className={mobileStyles.content}>
          <Outlet />
        </Flexbox>
      )}
    </Flexbox>
  );
};

export default Layout;
