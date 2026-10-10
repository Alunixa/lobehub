import type { ModelRuntimeHooks } from '@lobechat/model-runtime';

/** Match the API mode selected in provider settings, also for server runs. */
export const createProviderConfigHook = (
  runtimeProvider: string,
  enableResponseApi?: boolean,
): ModelRuntimeHooks => ({
  beforeChat: async (payload) => {
    if (runtimeProvider !== 'openai' || typeof enableResponseApi !== 'boolean') return;
    payload.apiMode = enableResponseApi ? 'responses' : 'chatCompletion';
  },
});
