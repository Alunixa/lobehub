import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useLoadedBackground } from './useLoadedBackground';

describe('loaded background lifetime', () => {
  it('starts opaque while the first background loads', () => {
    const { result } = renderHook(() => useLoadedBackground());
    expect(result.current.loaded).toBe(false);
  });

  it('keeps a loaded single image active across settings saves and re-renders', () => {
    const { result, rerender } = renderHook(() => useLoadedBackground());
    act(() => result.current.markLoaded('/f/file_one'));
    expect(result.current.loaded).toBe(true);
    rerender();
    expect(result.current.loaded).toBe(true);
  });
});
