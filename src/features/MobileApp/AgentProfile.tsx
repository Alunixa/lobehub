'use client';

import { Flexbox } from '@lobehub/ui';
import { cx } from 'antd-style';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import AsyncError from '@/components/AsyncError';
import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import EditLockDriver from '@/routes/(main)/agent/profile/features/EditLockDriver';
import ProfileEditor from '@/routes/(main)/agent/profile/features/ProfileEditor';
import ProfileHydration from '@/routes/(main)/agent/profile/features/ProfileHydration';
import ProfileProvider from '@/routes/(main)/agent/profile/features/ProfileProvider';
import { useAgentStore } from '@/store/agent';
import { agentSelectors } from '@/store/agent/selectors';

import { MobilePageHeader } from './Header';
import { mobileStyles as styles } from './styles';

export const MobileAgentProfile = () => {
  const { t } = useTranslation('common');
  const { aid } = useParams<{ aid: string }>();
  const navigate = useWorkspaceAwareNavigate();
  const error = useAgentStore(agentSelectors.currentAgentConfigError);
  const isLoading = useAgentStore(agentSelectors.isAgentConfigLoading);
  const retry = useAgentStore((s) => s.retryAgentConfigFetch);

  return (
    <Flexbox className={styles.page}>
      <MobilePageHeader
        title={t('mobile.agentProfile')}
        onBack={() => navigate(`/agent/${aid}/settings`)}
      />
      <Flexbox className={styles.scroll}>
        <Flexbox className={cx(styles.content, styles.settings)}>
          <ProfileProvider>
            <EditLockDriver />
            {error ? (
              <AsyncError error={error} onRetry={retry} />
            ) : isLoading ? (
              <NeuralNetworkLoading size={40} />
            ) : (
              <ProfileEditor />
            )}
            <Suspense fallback={null}>
              <ProfileHydration />
            </Suspense>
          </ProfileProvider>
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
};
