'use client';

import { Flexbox } from '@lobehub/ui';
import { ChatHeader } from '@lobehub/ui/mobile';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';

import { MOBILE_TABBAR_HEIGHT } from '@/const/layoutTokens';
import RegisterHotkeys from '@/routes/(main)/(create)/image/_layout/RegisterHotkeys';
import { mobileHeaderSticky } from '@/styles/mobileHeader';

const MobileImageLayout = () => {
  const { t } = useTranslation('common');

  return (
    <Flexbox
      height={`calc(100% - ${MOBILE_TABBAR_HEIGHT}px)`}
      style={{ overflow: 'hidden' }}
      width={'100%'}
    >
      <ChatHeader
        center={<ChatHeader.Title title={t('tab.image')} />}
        style={mobileHeaderSticky}
      />
      <Flexbox flex={1} style={{ minHeight: 0, overflow: 'hidden' }} width={'100%'}>
        <Outlet />
      </Flexbox>
      <RegisterHotkeys />
    </Flexbox>
  );
};

export default MobileImageLayout;
