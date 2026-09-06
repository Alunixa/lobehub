'use client';

import { memo } from 'react';
import { Outlet } from 'react-router';

import MobileContentLayout from '@/components/server/MobileNavLayout';
import { MobileSettingsHeader } from '@/features/MobileApp/SettingsHeader';

import SettingsContextProvider from '../../../(main)/settings/_layout/ContextProvider';

const MobileSettingsWrapper = memo(() => {
  return (
    <SettingsContextProvider
      value={{
        showOpenAIApiKey: true,
        showOpenAIProxyUrl: true,
      }}
    >
      <MobileContentLayout header={<MobileSettingsHeader />}>
        <Outlet />
      </MobileContentLayout>
    </SettingsContextProvider>
  );
});

MobileSettingsWrapper.displayName = 'MobileSettingsWrapper';

export default MobileSettingsWrapper;
