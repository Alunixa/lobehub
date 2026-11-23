export type UserMemoryEffort = 'high' | 'low' | 'medium';

export interface UserMemoryEmbeddingSettings {
  enabled?: boolean;
  model?: string;
}

export interface UserMemoryTextModelSettings {
  enabled?: boolean;
  model?: string;
}

export interface UserMemorySettings {
  effort?: UserMemoryEffort;
  embedding?: UserMemoryEmbeddingSettings;
  enabled?: boolean;
  humanMemoryEmbeddingModel?: string;
  humanMemoryEnabled?: boolean;
  humanMemoryModel?: string;
  humanMemoryWindowSize?: number;
  textModel?: UserMemoryTextModelSettings;
}
