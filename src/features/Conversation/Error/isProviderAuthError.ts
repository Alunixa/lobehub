import { AgentRuntimeErrorType } from '@lobechat/types';

const providerAuthErrors = new Set<string>([
  AgentRuntimeErrorType.InvalidProviderAPIKey,
  AgentRuntimeErrorType.NoOpenAIAPIKey,
  AgentRuntimeErrorType.InvalidBedrockCredentials,
  AgentRuntimeErrorType.InvalidVertexCredentials,
  AgentRuntimeErrorType.InvalidGithubToken,
  AgentRuntimeErrorType.InvalidGithubCopilotToken,
]);

export const isProviderAuthError = (type: string | number | undefined): boolean =>
  typeof type === 'string' && providerAuthErrors.has(type);
