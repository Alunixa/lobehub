'use client';

import { Flexbox, Icon, Text } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { Brain, BrainCircuit, ClipboardList, Compass, ImagePlus, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

import { MobilePageHeader } from './Header';
import { mobileStyles as styles } from './styles';

export const MobileWorkbench = () => {
  const { t } = useTranslation(['common', 'setting']);
  const navigate = useWorkspaceAwareNavigate();
  const { showMarket, showProvider } = useServerConfigStore(featureFlagsSelectors);
  const entries = [
    {
      description: t('mobile.tasksDescription'),
      icon: ClipboardList,
      path: '/tasks',
      title: t('mobile.tasks'),
    },
    {
      description: t('mobile.imageDescription'),
      icon: ImagePlus,
      path: '/image',
      title: t('mobile.createImage'),
    },
    ...(showProvider
      ? [
          {
            description: t('mobile.providersDescription'),
            icon: Brain,
            personal: true,
            path: '/settings/provider/all',
            title: t('tab.provider', { ns: 'setting' }),
          },
        ]
      : []),
    {
      description: t('mobile.memoryDescription'),
      icon: BrainCircuit,
      personal: true,
      path: '/settings/memory',
      title: t('tab.memory', { ns: 'setting' }),
    },
    ...(showMarket
      ? [
          {
            description: t('mobile.discoverDescription'),
            icon: Compass,
            path: '/community',
            title: t('tab.community'),
          },
        ]
      : []),
    {
      description: t('mobile.settingsDescription'),
      icon: Settings2,
      personal: true,
      path: '/me/settings',
      title: t('mobile.settings'),
    },
  ];
  return (
    <Flexbox className={styles.page}>
      <MobilePageHeader subtitle={t('mobile.workbenchDescription')} title={t('mobile.workbench')} />
      <Flexbox className={styles.scroll}>
        <Flexbox className={styles.content} gap={20}>
          <div className={styles.quickGrid}>
            {entries.map((entry) => (
              <Button
                className={styles.quickAction}
                key={entry.path}
                type={'text'}
                onClick={() =>
                  navigate(entry.path, { escape: 'personal' in entry && entry.personal })
                }
              >
                <div className={styles.rowIcon}>
                  <Icon icon={entry.icon} size={22} />
                </div>
                <Flexbox gap={6} style={{ minWidth: 0, whiteSpace: 'normal' }}>
                  <Text weight={600}>{entry.title}</Text>
                  <Text fontSize={12} type={'secondary'}>
                    {entry.description}
                  </Text>
                </Flexbox>
              </Button>
            ))}
          </div>
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
};
