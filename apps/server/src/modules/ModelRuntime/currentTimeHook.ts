import type { ModelRuntimeHooks } from '@lobechat/model-runtime';
import type { RequestTimeSettings } from '@lobechat/utils/currentTime';
import { withCurrentTime } from '@lobechat/utils/currentTime';

/** Read preferences and the clock per invocation, not at operation/runtime creation. */
export const createCurrentTimeHook = (
  getSettings: () => Promise<RequestTimeSettings | undefined>,
): ModelRuntimeHooks => ({
  beforeChat: async (payload) => {
    payload.messages = withCurrentTime(payload.messages, (await getSettings()) ?? {});
  },
  beforeGenerateObject: async (payload) => {
    payload.messages = withCurrentTime(payload.messages, (await getSettings()) ?? {});
  },
});
