import { memo, useMemo } from 'react';

import { useHomeStore } from '@/store/home';
import { useSessionStore } from '@/store/session';

import SkeletonList from '../SkeletonList';
import AgentList from './AgentList';
import { filterMobileAgentItems } from './agentListUtils';

const SearchMode = memo(() => {
  const sessionSearchKeywords = useSessionStore((s) => s.sessionSearchKeywords);
  const useSearchAgents = useHomeStore((s) => s.useSearchAgents);
  const { data, isLoading } = useSearchAgents(sessionSearchKeywords);

  const filteredData = useMemo(() => filterMobileAgentItems(data ?? []), [data]);

  return isLoading ? (
    <SkeletonList />
  ) : (
    <AgentList dataSource={filteredData} showAddButton={false} />
  );
});

SearchMode.displayName = 'SessionSearchMode';

export default SearchMode;
