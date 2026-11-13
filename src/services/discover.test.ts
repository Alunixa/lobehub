import { afterEach, describe, expect, it, vi } from 'vitest';

import { lambdaClient } from '@/libs/trpc/client';

import { discoverService } from './discover';

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    market: {
      skill: {
        getSkillList: { query: vi.fn() },
      },
    },
  },
}));

describe('DiscoverService marketplace authentication', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not require browser machine credentials before a public Skill catalogue request', async () => {
    const calls: string[] = [];
    const response = {
      currentPage: 1,
      items: [],
      pageSize: 20,
      totalCount: 0,
      totalPages: 0,
    };

    vi.spyOn(discoverService, 'safeInjectMPToken').mockImplementation(async () => {
      calls.push('token');
    });
    vi.spyOn(lambdaClient.market.skill.getSkillList, 'query').mockImplementation(async () => {
      calls.push('catalogue');
      return response;
    });

    await expect(discoverService.getSkillList({ page: 1 })).resolves.toBe(response);
    expect(calls).toEqual(['catalogue']);
  });
});
