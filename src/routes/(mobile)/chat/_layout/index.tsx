'use client';

import { type FC } from 'react';
import { Outlet, useLocation } from 'react-router';

import MobileContentLayout from '@/components/server/MobileNavLayout';
import { MobileConversationHeader } from '@/features/MobileApp/ChatHeader';
import { useInitAgentConfig } from '@/hooks/useInitAgentConfig';
import AgentIdSync from '@/routes/(main)/agent/_layout/AgentIdSync';

import { styles } from './style';

const Layout: FC = () => {
  useInitAgentConfig();
  const { pathname } = useLocation();
  const isSettings = /\/(?:settings|profile)\/?$/.test(pathname);

  return (
    <>
      {isSettings ? (
        <Outlet />
      ) : (
        <MobileContentLayout
          className={styles.mainContainer}
          header={<MobileConversationHeader />}
          scrollable={false}
        >
          <Outlet />
        </MobileContentLayout>
      )}
      <AgentIdSync />
    </>
  );
};

export default Layout;
