import type { EditMessageContentParams, InsertContextMessageParams } from '@lobechat/types';
import type { StateCreator } from 'zustand';

import { messageService } from '@/services/message';
import { messageMapKey } from '@/store/chat/utils/messageMapKey';

import type { Store as ConversationStore } from '../../../action';
import { messageStateSelectors } from '../../messageState/selectors';

export interface MessageContentAction {
  insertContextMessage: (params: Omit<InsertContextMessageParams, 'threadId'>) => Promise<void>;
  saveMessageContent: (params: EditMessageContentParams) => Promise<void>;
}

export const messageContentSlice: StateCreator<
  ConversationStore, [['zustand/devtools', never]], [], MessageContentAction
> = (_set, get) => {
  const mutate = async (
    request: () => Promise<{ messages?: import('@lobechat/types').UIChatMessage[]; success: boolean }>,
  ) => {
    const state = get();
    if (messageStateSelectors.isInputLoading(state))
      throw new Error('Wait for the current response to finish before editing conversation context');
    const context = { ...state.context };
    const result = await request();
    if (!result.success || !result.messages) throw new Error('Message content was not saved');
    if (messageMapKey(context) === messageMapKey(get().context)) {
      get().replaceMessages(result.messages);
    } else {
      state.onMessagesChange?.(result.messages, context);
    }
  };
  return {
    insertContextMessage: (params) => mutate(() => messageService.insertContextMessage({
      ...params, threadId: get().context.threadId,
    })),
    saveMessageContent: (params) => mutate(() => messageService.editMessageContent(params)),
  };
};
