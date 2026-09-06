'use client';

import { Flexbox } from '@lobehub/ui';
import { ActionIcon, Button, DropdownMenu, Text } from '@lobehub/ui/base-ui';
import {
  ArrowLeft,
  ChevronDown,
  MessageSquarePlus,
  MoreHorizontal,
  Settings2,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import ShareButton from '@/routes/(main)/agent/features/Conversation/Header/ShareButton';
import { useAgentStore } from '@/store/agent';
import { agentSelectors, builtinAgentSelectors } from '@/store/agent/selectors';
import { useChatStore } from '@/store/chat';
import { topicSelectors } from '@/store/chat/selectors';
import { useGlobalStore } from '@/store/global';

import { mobileStyles as styles } from './styles';

const touchSize = { blockSize: 44, size: 21 };

export const MobileConversationHeader = () => {
  const { t } = useTranslation(['common', 'chat', 'topic', 'setting']);
  const navigate = useWorkspaceAwareNavigate();
  const agentId = useAgentStore((s) => s.activeAgentId);
  const title = useAgentStore(agentSelectors.currentAgentTitle);
  const isInbox = useAgentStore(builtinAgentSelectors.isInboxAgent);
  const topic = useChatStore(topicSelectors.currentActiveTopic);
  const toggleTopics = useGlobalStore((s) => s.toggleMobileTopic);
  const openNewTopic = useChatStore((s) => s.openNewTopicOrSaveTopic);
  return (
    <Flexbox horizontal align={'center'} className={styles.header} gap={2}>
      <ActionIcon
        aria-label={t('back')}
        icon={ArrowLeft}
        size={touchSize}
        onClick={() => navigate('/agent')}
      />
      <Button
        aria-label={t('mobile.conversationHistory')}
        style={{ flex: 1, height: 'auto', minHeight: 44, minWidth: 0, padding: '4px 0' }}
        type={'text'}
        onClick={() => toggleTopics()}
      >
        <Flexbox gap={2} style={{ flex: 1, minWidth: 0, textAlign: 'start' }}>
          <Text ellipsis fontSize={16} weight={600}>
            {isInbox ? 'Lobe AI' : title}
          </Text>
          <Text ellipsis fontSize={12} type={'secondary'}>
            {topic?.title || t('title', { ns: 'topic' })}
          </Text>
        </Flexbox>
        <ChevronDown size={16} style={{ flex: 'none' }} />
      </Button>
      <ShareButton mobile />
      <DropdownMenu
        placement={'bottomRight'}
        items={[
          {
            icon: MessageSquarePlus,
            key: 'new',
            label: t('mobile.newConversation'),
            onClick: () => void openNewTopic(),
          },
          {
            icon: UserRound,
            key: 'profile',
            label: t('mobile.agentProfile'),
            onClick: () => agentId && navigate(`/agent/${agentId}/profile`),
          },
          {
            icon: Settings2,
            key: 'settings',
            label: t('header.session', { ns: 'setting' }),
            onClick: () => agentId && navigate(`/agent/${agentId}/settings`),
          },
          {
            icon: SlidersHorizontal,
            key: 'params',
            label: t('settingModel.params.title', { ns: 'setting' }),
            onClick: () => agentId && navigate(`/agent/${agentId}/settings?section=params`),
          },
        ]}
      >
        <ActionIcon
          aria-label={t('mobile.conversationActions')}
          icon={MoreHorizontal}
          size={touchSize}
        />
      </DropdownMenu>
    </Flexbox>
  );
};
