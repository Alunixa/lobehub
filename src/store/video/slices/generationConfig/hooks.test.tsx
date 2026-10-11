import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useVideoStore } from '@/store/video';

import { useVideoUploadingPreview } from './hooks';

beforeEach(() => useVideoStore.setState({ uploadingImagePreviews: [] }));
afterEach(() => vi.restoreAllMocks());

describe('video reference upload lifecycle', () => {
  it('tracks concurrent uploads independently and removes only the completed preview', () => {
    const { result } = renderHook(useVideoUploadingPreview);
    act(() => {
      result.current('blob:start-frame', true);
      result.current('blob:end-frame', true);
    });
    expect(useVideoStore.getState().uploadingImagePreviews).toEqual([
      'blob:start-frame',
      'blob:end-frame',
    ]);
    act(() => result.current('blob:start-frame', false));
    expect(useVideoStore.getState().uploadingImagePreviews).toEqual(['blob:end-frame']);
    act(() => result.current('blob:end-frame', false));
    expect(useVideoStore.getState().uploadingImagePreviews).toEqual([]);
  });

  it('keeps its callback stable while upload state changes', () => {
    const { result, rerender } = renderHook(useVideoUploadingPreview);
    const original = result.current;
    act(() => original('blob:reference', true));
    rerender();
    expect(result.current).toBe(original);
    act(() => result.current('blob:reference', false));
    expect(useVideoStore.getState().uploadingImagePreviews).toEqual([]);
  });
});
