export type UserMemoryEffort = 'high' | 'low' | 'medium';

export interface UserMemoryEmbeddingSettings {
  enabled?: boolean;
  model?: string;
}

export interface UserMemorySettings {
  effort?: UserMemoryEffort;
  embedding?: UserMemoryEmbeddingSettings;
  enabled?: boolean;
}
