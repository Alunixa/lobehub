import { describe, expect, it } from 'vitest';

import { isProviderAuthError } from './isProviderAuthError';

describe('provider auth error routing', () => {
  it.each([
    'InvalidRequestFormat',
    'InvalidOllamaArgs',
    'InvalidComfyUIArgs',
    'ProviderBizError',
    'UnknownInvalidError',
    400,
    undefined,
  ])('does not tell users to replace valid keys for %s', (type) => {
    expect(isProviderAuthError(type)).toBe(false);
  });

  it.each([
    'InvalidProviderAPIKey',
    'NoOpenAIAPIKey',
    'InvalidBedrockCredentials',
    'InvalidVertexCredentials',
    'InvalidGithubToken',
    'InvalidGithubCopilotToken',
  ])('keeps credential recovery for %s', (type) => {
    expect(isProviderAuthError(type)).toBe(true);
  });
});
