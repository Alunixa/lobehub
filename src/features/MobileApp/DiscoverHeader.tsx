'use client';

import { Flexbox } from '@lobehub/ui';
import { Tabs } from '@lobehub/ui/base-ui';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';

import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import StoreSearchBar from '@/routes/(main)/community/features/Search';

import { MobilePageHeader } from './Header';
import { mobileStyles as styles } from './styles';

export const MobileDiscoverHeader = () => {
  const { t } = useTranslation(['common', 'discover']);
  const navigate = useWorkspaceAwareNavigate();
  const { pathname } = useLocation();
  const segment = pathname.split('/community')[1]?.split('/').find(Boolean) || '';
  return (
    <Flexbox style={{ flex: 'none' }}>
      <MobilePageHeader title={t('tab.community')} />
      <Flexbox padding={'12px 16px 4px'}>
        <StoreSearchBar mobile />
      </Flexbox>
      <div className={styles.tabs}>
        <Tabs
          activeKey={segment}
          styles={{ list: { width: 'max-content', minWidth: '100%' }, tab: { minHeight: 44 } }}
          items={[
            { key: '', label: t('tab.home', { ns: 'discover' }) },
            { key: 'agent', label: t('tab.assistant', { ns: 'discover' }) },
            { key: 'mcp', label: 'MCP' },
            { key: 'model', label: t('tab.model', { ns: 'discover' }) },
            { key: 'provider', label: t('tab.provider', { ns: 'discover' }) },
          ]}
          onChange={(key) => navigate(key ? `/community/${key}` : '/community')}
        />
      </div>
    </Flexbox>
  );
};
