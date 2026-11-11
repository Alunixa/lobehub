import type { BackgroundConfig } from '@lobechat/types';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeBackgroundConfig } from '@/features/GlobalBackground/config';
import { backgroundService } from '@/services/background';

import { cropUploadedBackground } from './CropImage';
import { useBackgroundSetting } from './useBackgroundSetting';

const state = vi.hoisted(() => ({
  general: { background: {} as { desktop?: BackgroundConfig; mobile?: BackgroundConfig } },
  isUserStateInit: true,
  setSettings: vi.fn(),
  user: { id: 'cancel-background-fixture' },
}));
vi.mock('@/store/user', () => ({
  useUserStore: (selector: (value: typeof state) => unknown) => selector(state),
}));
vi.mock('@/store/user/selectors', () => ({
  userGeneralSettingsSelectors: { config: (value: typeof state) => value.general },
}));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/services/background', () => ({ backgroundService: { uploadImage: vi.fn() } }));
vi.mock('./CropImage', () => ({ cropUploadedBackground: vi.fn() }));

describe('background upload cancellation', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    state.general.background = { desktop: normalizeBackgroundConfig() };
  });

  it('does not add a late file result to the background after cancel is requested', async () => {
    const file = new File(['image'], 'crop.png', { type: 'image/png' });
    vi.mocked(cropUploadedBackground).mockResolvedValue(file);
    let complete: (value: { id: string; name: string; url: string }) => void = () => {};
    vi.mocked(backgroundService.uploadImage).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const { result } = renderHook(() => useBackgroundSetting());
    let pending: Promise<void>;
    await act(async () => {
      pending = result.current.upload([file]);
      await Promise.resolve();
    });
    expect(backgroundService.uploadImage).toHaveBeenCalledOnce();
    act(() => result.current.cancelUpload());
    await act(async () => {
      complete({ id: 'file_cancelled', name: file.name, url: '/f/file_cancelled' });
      await pending;
    });
    expect(result.current.config.images).toEqual([]);
    expect(result.current.uploading).toBe(false);
    expect(state.setSettings).not.toHaveBeenCalled();
  });
});
