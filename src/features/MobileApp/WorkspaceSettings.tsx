'use client';

import { Flexbox } from '@lobehub/ui';
import { Select } from '@lobehub/ui/base-ui';
import { cx } from 'antd-style';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router';

import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { useWorkspaceSettingCategory } from '@/features/WorkspaceSetting/hooks/useCategory';

import { MobilePageHeader } from './Header';
import { mobileStyles as styles } from './styles';

const supportedSections = new Set([
  'general',
  'members',
  'plans',
  'billing',
  'credits',
  'usage',
  'audit-log',
]);

export const MobileWorkspaceSettings = () => {
  const { t } = useTranslation('common');
  const navigate = useWorkspaceAwareNavigate();
  const { pathname } = useLocation();
  const groups = useWorkspaceSettingCategory();
  const options = groups.flatMap((group) =>
    group.items
      .filter((item) => supportedSections.has(item.key))
      .map((item) => ({ label: item.label, value: item.key })),
  );

  return (
    <Flexbox className={styles.page}>
      <MobilePageHeader title={t('mobile.workspaceSettings')} onBack={() => navigate('/tools')} />
      <Flexbox padding={'12px 16px'} style={{ flex: 'none' }}>
        <Select
          aria-label={t('mobile.workspaceSettings')}
          options={options}
          style={{ minHeight: 44 }}
          value={pathname.split('/').filter(Boolean)[2] || 'general'}
          onChange={(value) => navigate(`/settings/${value}`)}
        />
      </Flexbox>
      <Flexbox className={styles.scroll}>
        <Flexbox className={cx(styles.content, styles.settings)}>
          <Outlet />
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
};
