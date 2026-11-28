import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useHomeAgentSetting } from './HomeAgentSetting';

const fixture = vi.hoisted(() => ({
  selected: 'custom',
  save: vi.fn().mockResolvedValue(undefined),
  initialized: true,
}));
vi.mock('@/hooks/useFetchAgentList', () => ({ useFetchAgentList: () => ({ mutate: vi.fn() }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@lobehub/ui', () => ({ Flexbox: () => null }));
vi.mock('@lobehub/ui/base-ui', () => ({
  Avatar: () => null,
  Button: () => null,
  Select: () => null,
  toast: { error: vi.fn() },
}));
vi.mock('@/store/home', () => ({ useHomeStore: (select: (s: unknown) => unknown) => select({}) }));
vi.mock('@/store/home/selectors', () => ({
  homeAgentListSelectors: {
    allAgents: () => [
      { id: 'custom', type: 'agent', title: 'My assistant', avatar: '🐱' },
      { id: 'group', type: 'group' },
    ],
    isAgentListInit: () => fixture.initialized,
  },
}));
vi.mock('@/store/user', () => ({
  useUserStore: (select: (s: unknown) => unknown) => select({ setSettings: fixture.save }),
}));
vi.mock('@/store/user/selectors', () => ({
  settingsSelectors: {
    currentSettings: () => ({ general: { homeDefaultAgentId: fixture.selected } }),
  },
}));

describe('account home agent setting', () => {
  beforeEach(() => {
    fixture.selected = 'custom';
    fixture.initialized = true;
    fixture.save.mockClear();
  });
  it('offers assistants with metadata, excludes groups and persists the selected account setting', async () => {
    const { result } = renderHook(() => useHomeAgentSetting());
    if (!Array.isArray(result.current.children)) throw new Error('Expected setting items');
    const select = result.current.children[0].children as React.ReactElement<{
      value: string;
      options: { value: string }[];
      onChange: (id: string) => void;
    }>;
    expect(select.props.value).toBe('custom');
    expect(select.props.options.map((o) => o.value)).toEqual(['', 'custom']);
    await act(async () => {
      select.props.onChange('');
    });
    expect(fixture.save).toHaveBeenCalledWith({ general: { homeDefaultAgentId: '' } });
  });
  it('displays the default option when the saved assistant has been deleted', () => {
    fixture.selected = 'deleted';
    const { result } = renderHook(() => useHomeAgentSetting());
    if (!Array.isArray(result.current.children)) throw new Error('Expected setting items');
    const select = result.current.children[0].children as React.ReactElement<{ value: string }>;
    expect(select.props.value).toBe('');
  });
});
