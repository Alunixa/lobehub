'use client';

import { Flexbox } from '@lobehub/ui';
import { cx } from 'antd-style';
import { useParams } from 'react-router';

import { useQueryState } from '@/hooks/useQueryParam';
import SettingsContent from '@/routes/(main)/settings/features/SettingsContent';

import { MobileSecuritySettings } from './Security';
import { MobileSettingsHub } from './SettingsHub';
import { mobileStyles as styles } from './styles';

export const MobileSettingsPage = () => {
  const { tab } = useParams<{ tab?: string }>();
  const [legacyTab] = useQueryState('active');
  const activeTab = tab || legacyTab;

  // The parent route owns the one and only header and scroll container.
  if (!activeTab) return <MobileSettingsHub />;
  if (activeTab === 'security') return <MobileSecuritySettings />;
  return (
    <Flexbox className={cx(styles.content, styles.settings)} data-testid={'mobile-settings-page'}>
      <SettingsContent mobile activeTab={activeTab} />
    </Flexbox>
  );
};
