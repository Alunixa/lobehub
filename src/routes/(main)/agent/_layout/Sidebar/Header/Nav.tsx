'use client';

import { Flexbox } from '@lobehub/ui';
import { BotPromptIcon } from '@lobehub/ui/icons';
import {
  MessageSquarePlusIcon,
  MessagesSquareIcon,
  RadioTowerIcon,
  SearchIcon,
} from 'lucide-react';
import { memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import urlJoin from 'url-join';

import NavItem from '@/features/NavPanel/components/NavItem';
import { usePermission } from '@/hooks/usePermission';
import { useQueryRoute } from '@/hooks/useQueryRoute';
import { usePathname } from '@/libs/router/navigation';
import { useActionSWR } from '@/libs/swr';
import { topicActionKeys } from '@/libs/swr/keys';
import { useAgentStore } from '@/store/agent';
import { agentSelectors } from '@/store/agent/selectors';
import { useChatStore } from '@/store/chat';
import { useGlobalStore } from '@/store/global';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

const Nav = memo(() => {
  const { t } = useTranslation('chat');
  const { t: tTopic } = useTranslation('topic');
  const params = useParams();
  const agentId = params.aid;
  const pathname = usePathname();
  const isProfileActive = pathname.includes('/profile');
  const isChannelActive = pathname.includes('/channel');
  // Topic IDs are prefixed `topics_`, so /agent/:aid/topics_abc would also match
  // pathname.includes('/topics') — anchor to end to avoid that false positive.
  const isTopicsActive = pathname.endsWith('/topics');
  const router = useQueryRoute();
  const { allowed: canCreateTopic } = usePermission('create_content');
  const { isAgentEditable } = useServerConfigStore(featureFlagsSelectors);
  const toggleCommandMenu = useGlobalStore((s) => s.toggleCommandMenu);
  const heterogeneousProviderType = useAgentStore(
    agentSelectors.currentAgentHeterogeneousProviderType,
  );
  const hideProfile = !isAgentEditable;
  // Claude Code agents can use message channels; other hetero providers (e.g. codex) still hide it.
  const hideChannel =
    hideProfile || (!!heterogeneousProviderType && heterogeneousProviderType !== 'claude-code');
  const switchTopic = useChatStore((s) => s.switchTopic);
  const [openNewTopicOrSaveTopic] = useChatStore((s) => [s.openNewTopicOrSaveTopic]);
  const routeRef = useRef({ agentId, pathname, topicId: params.topicId });
  routeRef.current = { agentId, pathname, topicId: params.topicId };
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const { mutate, isValidating } = useActionSWR(
    // A shared action key can select another composer's fetcher, losing the
    // source route before ChatHydration is ready. Keep this intent route-owned.
    [...topicActionKeys.openNewOrSave(), 'sidebar', pathname],
    () => {
      const source = routeRef.current;
      return openNewTopicOrSaveTopic({
        source: source.agentId ? { agentId: source.agentId, topicId: source.topicId } : undefined,
        isCurrent: () => mountedRef.current && routeRef.current.pathname === source.pathname,
      });
    },
    { shouldRetryOnError: false },
  );
  const handleNewTopic = async () => {
    if (!canCreateTopic) return;
    const source = routeRef.current;
    const opened = await mutate();
    if (!opened || !mountedRef.current || routeRef.current.pathname !== source.pathname) return;
    // Always navigate to the bare agent chat URL — drops any sub-route
    // (/profile, /channel, /page, /cron/:cronId, …) and any `:topicId`
    // segment so the new topic isn't conflated with the previous URL.
    if (source.agentId) {
      router.push(urlJoin('/agent', source.agentId));
    }
  };

  return (
    <Flexbox gap={1} paddingInline={4}>
      <NavItem
        disabled={!canCreateTopic || isValidating}
        icon={MessageSquarePlusIcon}
        loading={isValidating}
        title={tTopic('actions.addNewTopic')}
        onClick={handleNewTopic}
      />
      <NavItem
        icon={SearchIcon}
        title={t('tab.search')}
        onClick={() => {
          toggleCommandMenu(true);
        }}
      />
      {!hideProfile && (
        <NavItem
          active={isProfileActive}
          icon={BotPromptIcon}
          title={t('tab.profile')}
          onClick={() => {
            switchTopic(null, { skipRefreshMessage: true });
            router.push(urlJoin('/agent', agentId!, 'profile'));
          }}
        />
      )}
      <NavItem
        active={isTopicsActive}
        icon={MessagesSquareIcon}
        title={tTopic('management.sidebarEntry')}
        onClick={() => {
          switchTopic(null, { skipRefreshMessage: true });
          router.push(urlJoin('/agent', agentId!, 'topics'));
        }}
      />
      {!hideChannel && (
        <NavItem
          active={isChannelActive}
          icon={RadioTowerIcon}
          title={t('tab.integration')}
          onClick={() => {
            switchTopic(null, { skipRefreshMessage: true });
            router.push(urlJoin('/agent', agentId!, 'channel'));
          }}
        />
      )}
    </Flexbox>
  );
});

export default Nav;
