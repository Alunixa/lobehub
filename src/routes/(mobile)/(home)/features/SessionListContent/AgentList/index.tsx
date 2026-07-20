import type { SidebarAgentItem } from '@lobechat/types';
import { memo } from 'react';

import { filterMobileAgentItems } from '../agentListUtils';
import AddButton from '../List/AddButton';
import AgentItem from './Item';

interface AgentListProps {
  dataSource?: SidebarAgentItem[];
  showAddButton?: boolean;
}

const AgentList = memo<AgentListProps>(({ dataSource = [], showAddButton = true }) => {
  const agents = filterMobileAgentItems(dataSource);

  if (agents.length === 0) {
    return showAddButton ? <AddButton /> : null;
  }

  return agents.map((item) => <AgentItem item={item} key={item.id} />);
});

AgentList.displayName = 'MobileAgentList';

export default AgentList;
