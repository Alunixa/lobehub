import type { SidebarAgentItem, SidebarGroup } from '@lobechat/types';

export const filterMobileAgentItems = (items: SidebarAgentItem[]): SidebarAgentItem[] =>
  items.filter((item) => item.type === 'agent');

export const filterMobileAgentGroups = (groups: SidebarGroup[]): SidebarGroup[] =>
  groups
    .map((group) => ({
      ...group,
      items: filterMobileAgentItems(group.items),
    }))
    .filter((group) => group.items.length > 0);
