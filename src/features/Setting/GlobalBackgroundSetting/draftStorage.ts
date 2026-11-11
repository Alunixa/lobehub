import type { BackgroundConfig, BackgroundDevice } from '@lobechat/types';
import { isPlainRecord } from '@lobechat/utils/object';

import { normalizeBackgroundConfig } from '@/features/GlobalBackground/config';

const key = (userId: string, device: BackgroundDevice) =>
  `lobe-background-draft:v1:${encodeURIComponent(userId)}:${device}`;

export const readBackgroundDraft = (
  userId: string,
  device: BackgroundDevice,
): BackgroundConfig | undefined => {
  try {
    const raw = localStorage.getItem(key(userId, device));
    if (!raw) return;
    const value: unknown = JSON.parse(raw);
    if (
      !isPlainRecord(value) ||
      typeof value.savedAt !== 'number' ||
      Date.now() - value.savedAt > 7 * 24 * 60 * 60 * 1000
    )
      return;
    return normalizeBackgroundConfig(value.config);
  } catch (error) {
    console.error('Failed to restore background draft', error);
  }
};

export const writeBackgroundDraft = (
  userId: string,
  device: BackgroundDevice,
  config: BackgroundConfig,
) => {
  try {
    localStorage.setItem(
      key(userId, device),
      JSON.stringify({ config: normalizeBackgroundConfig(config), savedAt: Date.now() }),
    );
  } catch (error) {
    console.error('Failed to back up background draft', error);
  }
};

export const clearBackgroundDraft = (userId: string, device: BackgroundDevice) => {
  try {
    localStorage.removeItem(key(userId, device));
  } catch (error) {
    console.error('Failed to clear saved background draft', error);
  }
};
