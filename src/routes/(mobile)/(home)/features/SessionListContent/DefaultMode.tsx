import { type CollapseProps } from 'antd';
import isEqual from 'fast-deep-equal';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useActiveWorkspaceId } from '@/business/client/hooks/useActiveWorkspaceId';
import AsyncError from '@/components/AsyncError';
import { useFetchAgentList } from '@/hooks/useFetchAgentList';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';
import { useHomeStore } from '@/store/home';
import { homeAgentListSelectors } from '@/store/home/selectors';
import { SessionDefaultGroup } from '@/types/session';

import SkeletonList from '../SkeletonList';
import AgentList from './AgentList';
import { filterMobileAgentGroups, filterMobileAgentItems } from './agentListUtils';
import CollapseGroup from './CollapseGroup';
import Inbox from './Inbox';

const DefaultMode = memo(() => {
  const { t } = useTranslation(['chat', 'common']);
  const { error, mutate } = useFetchAgentList();

  const isInit = useHomeStore(homeAgentListSelectors.isAgentListInit);
  const pinnedAgents = useHomeStore(homeAgentListSelectors.pinnedAgents, isEqual);
  const agentGroups = useHomeStore(homeAgentListSelectors.agentGroups, isEqual);
  const ungroupedAgents = useHomeStore(homeAgentListSelectors.ungroupedAgents, isEqual);
  const privateAgentGroups = useHomeStore(homeAgentListSelectors.privateAgentGroups, isEqual);
  const privateUngroupedAgents = useHomeStore(
    homeAgentListSelectors.privateUngroupedAgents,
    isEqual,
  );

  const {
    filteredAgentGroups,
    filteredPinnedAgents,
    filteredPrivateAgentGroups,
    filteredPrivateUngroupedAgents,
    filteredUngroupedAgents,
  } = useMemo(
    () => ({
      filteredAgentGroups: filterMobileAgentGroups(agentGroups),
      filteredPinnedAgents: filterMobileAgentItems(pinnedAgents),
      filteredPrivateAgentGroups: filterMobileAgentGroups(privateAgentGroups),
      filteredPrivateUngroupedAgents: filterMobileAgentItems(privateUngroupedAgents),
      filteredUngroupedAgents: filterMobileAgentItems(ungroupedAgents),
    }),
    [agentGroups, pinnedAgents, privateAgentGroups, privateUngroupedAgents, ungroupedAgents],
  );

  const activeWorkspaceId = useActiveWorkspaceId();
  const sessionGroupKeys = useGlobalStore(
    systemStatusSelectors.sessionGroupKeys(activeWorkspaceId),
  );
  const updateSystemStatus = useGlobalStore((s) => s.updateSystemStatus);

  const items = useMemo(
    () =>
      [
        filteredPinnedAgents.length > 0 && {
          children: <AgentList dataSource={filteredPinnedAgents} showAddButton={false} />,
          key: SessionDefaultGroup.Pinned,
          label: t('pin'),
        },
        ...filteredAgentGroups.map(({ id, name, items: agents }) => ({
          children: <AgentList dataSource={agents} showAddButton={false} />,
          key: id,
          label: name,
        })),
        {
          children: <AgentList dataSource={filteredUngroupedAgents} />,
          key: SessionDefaultGroup.Default,
          label: t('defaultList'),
        },
        ...filteredPrivateAgentGroups.map(({ id, name, items: agents }) => ({
          children: <AgentList dataSource={agents} showAddButton={false} />,
          key: `private:${id}`,
          label: `${name} · ${t('navPanel.privateAgents', { ns: 'common' })}`,
        })),
        filteredPrivateUngroupedAgents.length > 0 && {
          children: <AgentList dataSource={filteredPrivateUngroupedAgents} showAddButton={false} />,
          key: 'private:ungrouped',
          label: t('navPanel.privateAgents', { ns: 'common' }),
        },
      ].filter(Boolean) as CollapseProps['items'],
    [
      filteredAgentGroups,
      filteredPinnedAgents,
      filteredPrivateAgentGroups,
      filteredPrivateUngroupedAgents,
      filteredUngroupedAgents,
      t,
    ],
  );

  if (error && !isInit) return <AsyncError error={error} onRetry={() => mutate()} />;
  if (!isInit) return <SkeletonList />;

  return (
    <>
      {error && <AsyncError error={error} onRetry={() => mutate()} />}
      <Inbox />
      <CollapseGroup
        activeKey={sessionGroupKeys}
        items={items}
        onChange={(keys) => {
          const expandSessionGroupKeys = typeof keys === 'string' ? [keys] : keys;
          updateSystemStatus({ expandSessionGroupKeys });
        }}
      />
    </>
  );
});

DefaultMode.displayName = 'SessionDefaultMode';

export default DefaultMode;
