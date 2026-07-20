import { AGENT_CHAT_URL, DEFAULT_AVATAR } from '@lobechat/const';
import type { SidebarAgentItem } from '@lobechat/types';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import WorkspaceLink from '@/features/Workspace/WorkspaceLink';
import { usePrefetchAgent } from '@/hooks/usePrefetchAgent';
import { useAgentStore } from '@/store/agent';
import { useChatStore } from '@/store/chat';
import { operationSelectors } from '@/store/chat/selectors';

import ListItem from '../../ListItem';

interface AgentItemProps {
  item: SidebarAgentItem;
}

const AgentItem = memo<AgentItemProps>(({ item }) => {
  const { t } = useTranslation('chat');
  const clearPortalStack = useChatStore((s) => s.clearPortalStack);
  const active = useAgentStore((s) => s.activeAgentId === item.id);
  const loading = useChatStore(operationSelectors.isAgentVisiblyRunning(item.id));
  const prefetchAgent = usePrefetchAgent();

  const displayTitle = item.title || t('untitledAgent');
  const avatar = typeof item.avatar === 'string' ? item.avatar : DEFAULT_AVATAR;

  return (
    <WorkspaceLink
      aria-label={displayTitle}
      to={AGENT_CHAT_URL(item.id, false)}
      onClick={clearPortalStack}
      onMouseEnter={() => prefetchAgent(item.id)}
    >
      <ListItem
        active={active}
        avatar={avatar}
        avatarBackground={item.backgroundColor || undefined}
        date={new Date(item.updatedAt).getTime()}
        loading={loading}
        pin={item.pinned}
        title={displayTitle}
        type="agent"
        styles={{
          container: {
            gap: 12,
          },
          content: {
            gap: 6,
            maskImage: `linear-gradient(90deg, #000 90%, transparent)`,
          },
        }}
      />
    </WorkspaceLink>
  );
});

AgentItem.displayName = 'MobileAgentItem';

export default AgentItem;
