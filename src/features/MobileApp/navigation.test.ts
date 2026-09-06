import { describe, expect, it } from 'vitest';

import { resolveMobileNavigation } from './navigationRules';

describe('mobile navigation', () => {
  it.each([
    ['/', 'chat', true],
    ['/image', 'image', true],
    ['/image/', 'image', true],
    ['/tasks', 'tools', true],
    ['/tools', 'tools', true],
    ['/me', 'me', true],
    ['/community/provider', 'community', true],
    ['/community/provider/openai', 'community', false],
    ['/agent/agent-1/topic-1', 'chat', false],
    ['/agent/agent-1/settings', 'chat', false],
    ['/settings/provider/all', 'chat', false],
    ['/task/task-1', 'tools', false],
  ])('maps %s without overlaying detail content', (path, active, showNav) => {
    expect(resolveMobileNavigation(path)).toEqual({ active, showNav });
  });

  it('keeps team navigation scoped without confusing similarly prefixed paths', () => {
    expect(resolveMobileNavigation('/team/image', 'team')).toEqual({
      active: 'image',
      showNav: true,
    });
    expect(resolveMobileNavigation('/team', 'team')).toEqual({ active: 'chat', showNav: true });
    expect(resolveMobileNavigation('/team-other/image', 'team').showNav).toBe(false);
    expect(resolveMobileNavigation('/me', 'team')).toEqual({ active: 'me', showNav: true });
  });
});
