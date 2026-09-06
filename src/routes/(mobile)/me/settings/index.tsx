'use client';

import { memo } from 'react';

import { MobileSettingsHub } from '@/features/MobileApp/SettingsHub';

const MeSettingsPage = memo(() => {
  return <MobileSettingsHub />;
});

MeSettingsPage.displayName = 'MeSettingsPage';

export default MeSettingsPage;
