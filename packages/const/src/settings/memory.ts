import { type UserMemorySettings } from '@lobechat/types';

export const DEFAULT_MEMORY_SETTINGS: UserMemorySettings = {
  enabled: true,
  embedding: { enabled: false },
  effort: 'medium',
  humanMemoryEnabled: false,
  humanMemoryWindowSize: 12,
  textModel: { enabled: false },
};
