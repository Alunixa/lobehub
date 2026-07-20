import type { SidebarAgentItem, SidebarGroup } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import { filterMobileAgentGroups, filterMobileAgentItems } from './agentListUtils';

const createItem = (id: string, type: SidebarAgentItem['type']): SidebarAgentItem => ({
  id,
  pinned: false,
  title: id,
  type,
  updatedAt: new Date('2026-07-20T00:00:00.000Z'),
});

describe('mobile agent list utilities', () => {
  it('keeps every agent while excluding unsupported chat groups', () => {
    const items = [
      createItem('agent-a', 'agent'),
      createItem('group-a', 'group'),
      createItem('agent-b', 'agent'),
    ];

    expect(filterMobileAgentItems(items).map((item) => item.id)).toEqual(['agent-a', 'agent-b']);
  });

  it('preserves agent folders and removes folders containing only chat groups', () => {
    const groups: SidebarGroup[] = [
      {
        id: 'mixed',
        items: [createItem('agent-a', 'agent'), createItem('group-a', 'group')],
        name: 'Mixed',
        sort: 0,
      },
      {
        id: 'groups-only',
        items: [createItem('group-b', 'group')],
        name: 'Groups only',
        sort: 1,
      },
    ];

    expect(filterMobileAgentGroups(groups)).toEqual([
      {
        ...groups[0],
        items: [createItem('agent-a', 'agent')],
      },
    ]);
  });
});
