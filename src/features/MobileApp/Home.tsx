'use client';

import { AGENT_CHAT_URL } from '@lobechat/const';
import { Flexbox, Text } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { App } from 'antd';
import { ImagePlus, MessageSquarePlus } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { usePermission } from '@/hooks/usePermission';
import SessionSearchBar from '@/routes/(mobile)/(home)/_layout/SessionSearchBar';
import { useHomeStore } from '@/store/home';
import { useSessionStore } from '@/store/session';

import { MobilePageHeader } from './Header';
import { mobileStyles as styles } from './styles';

export const MobileHomeLayout = ({ children }: PropsWithChildren) => {
  const { t } = useTranslation('common');
  const { message } = App.useApp();
  const navigate = useWorkspaceAwareNavigate();
  const { allowed: canCreate } = usePermission('create_content');
  const [creating, setCreating] = useState(false);
  const createSession = useSessionStore((s) => s.createSession);
  const refreshAgentList = useHomeStore((s) => s.refreshAgentList);

  const createAgent = async () => {
    if (creating || !canCreate) return;
    setCreating(true);
    try {
      const id = await createSession(undefined, false);
      navigate(AGENT_CHAT_URL(id, false));
      await refreshAgentList();
    } catch (error) {
      console.error('Failed to create mobile agent:', error);
      message.error(t('mobile.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Flexbox className={styles.page}>
      <MobilePageHeader
        subtitle={t('mobile.conversationsDescription')}
        title={t('mobile.conversations')}
        actions={
          <Button
            disabled={!canCreate || creating}
            icon={MessageSquarePlus}
            loading={creating}
            style={{ minHeight: 44 }}
            type={'primary'}
            onClick={() => void createAgent()}
          >
            {t('mobile.newAgent')}
          </Button>
        }
      />
      <Flexbox gap={12} padding={'16px 16px 12px'} style={{ flex: 'none' }}>
        <SessionSearchBar mobile />
        <Flexbox horizontal align={'center'} justify={'space-between'}>
          <Text fontSize={13} type={'secondary'}>
            {t('mobile.yourAgents')}
          </Text>
          <Button
            icon={ImagePlus}
            size={'small'}
            style={{ minHeight: 44 }}
            type={'text'}
            onClick={() => navigate('/image')}
          >
            {t('mobile.createImage')}
          </Button>
        </Flexbox>
      </Flexbox>
      <Flexbox className={styles.scroll} padding={'0 8px 16px'}>
        {children}
      </Flexbox>
    </Flexbox>
  );
};
