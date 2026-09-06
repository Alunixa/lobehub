'use client';

import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { MobilePageHeader } from '@/features/MobileApp/Header';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';

const Header = memo(() => {
  const { t } = useTranslation('common');
  const navigate = useWorkspaceAwareNavigate();

  return <MobilePageHeader title={t('tab.community')} onBack={() => navigate('/community')} />;
});

export default Header;
