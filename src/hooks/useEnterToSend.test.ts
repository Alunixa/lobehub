import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEnterToSend } from './useEnterToSend';

const state = vi.hoisted(() => ({ useCmdEnterToSend: false }));
vi.mock('@/store/user', () => ({
  useUserStore: (selector: (store: typeof state) => unknown) => selector(state),
}));
vi.mock('@/store/user/selectors', () => ({
  preferenceSelectors: {
    useCmdEnterToSend: (store: typeof state) => store.useCmdEnterToSend,
  },
}));

const enter = { ctrlKey: false, metaKey: false, shiftKey: false };
beforeEach(() => {
  state.useCmdEnterToSend = false;
});

describe('Enter behavior on touch and desktop inputs', () => {
  it('never sends on a plain touch-keyboard Enter', () => {
    const { result } = renderHook(() => useEnterToSend(true));
    expect(result.current(enter)).toBe(false);
    state.useCmdEnterToSend = true;
    expect(result.current(enter)).toBe(false);
  });

  it('preserves desktop preferences and Shift+Enter line breaks', () => {
    const { result, rerender } = renderHook(() => useEnterToSend());
    expect(result.current(enter)).toBe(true);
    expect(result.current({ ...enter, shiftKey: true })).toBe(false);
    state.useCmdEnterToSend = true;
    rerender();
    expect(result.current(enter)).toBe(false);
  });
});
