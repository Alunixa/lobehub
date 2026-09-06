'use client';

import { Button, Icon } from '@lobehub/ui';
import { Compass, Grid2X2, ImageIcon, MessageSquare, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';

import { useActiveWorkspaceSlug } from '@/business/client/hooks/useActiveWorkspaceSlug';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

import { resolveMobileNavigation } from './navigation';
import { mobileStyles as styles } from './styles';

export const MobileNavigation = () => {
  const { t } = useTranslation('common');
  const { pathname } = useLocation();
  const workspaceSlug = useActiveWorkspaceSlug();
  const navigate = useWorkspaceAwareNavigate();
  const { showMarket } = useServerConfigStore(featureFlagsSelectors);
  const { active, showNav } = resolveMobileNavigation(pathname, workspaceSlug);
  const items = [
    { icon: MessageSquare, key: 'chat', label: t('tab.chat'), path: '/agent' },
    { icon: ImageIcon, key: 'image', label: t('tab.image'), path: '/image' },
    { icon: Grid2X2, key: 'tools', label: t('mobile.workbench'), path: '/tools' },
    ...(showMarket
      ? [{ icon: Compass, key: 'community', label: t('tab.community'), path: '/community' }]
      : []),
    { icon: User, key: 'me', label: t('tab.me'), path: '/me' },
  ];

  if (!showNav) return null;

  return (
    <nav aria-label={t('mobile.navigation')} className={styles.navigation}>
      {items.map((item) => (
        <Button
          aria-current={active === item.key ? 'page' : undefined}
          className={styles.navButton}
          key={item.key}
          type={'text'}
          onClick={() => navigate(item.path, { escape: item.key === 'me' })}
        >
          <Icon icon={item.icon} size={21} />
          <span>{item.label}</span>
        </Button>
      ))}
    </nav>
  );
};
