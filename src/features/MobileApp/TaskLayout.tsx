'use client';

import { Flexbox } from '@lobehub/ui';
import { useTranslation } from 'react-i18next';

import TaskWorkspaceLayout from '@/features/AgentTasks/TaskWorkspaceLayout';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';

import { MobilePageHeader } from './Header';
import { mobileStyles as styles } from './styles';

export const MobileTaskLayout = () => {
  const { t } = useTranslation('common');
  const navigate = useWorkspaceAwareNavigate();
  return (
    <Flexbox className={styles.page}>
      <MobilePageHeader title={t('mobile.tasks')} onBack={() => navigate('/tools')} />
      <Flexbox className={styles.viewport}>
        <TaskWorkspaceLayout />
      </Flexbox>
    </Flexbox>
  );
};
