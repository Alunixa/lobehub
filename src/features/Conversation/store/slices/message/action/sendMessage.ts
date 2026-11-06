import { type SendMessageParams } from '@lobechat/types';

import { useChatStore } from '@/store/chat';
import { messageMapKey } from '@/store/chat/utils/messageMapKey';
import { useFileStore } from '@/store/file';

import { isLocalOnlyMessage } from '../../../../utils/localMessages';
import { type Store as ConversationStore } from '../../../action';

/**
 * Send a message in this conversation
 *
 * This is a simplified wrapper that:
 * 1. Calls lifecycle hooks
 * 2. Forwards to ChatStore.sendMessage with context
 * 3. Passes displayMessages to decouple from store selectors
 *
 * All actual message sending logic lives in ChatStore.
 */
export const sendMessage = (
  set: (partial: Partial<ConversationStore>) => void,
  get: () => ConversationStore,
) => {
  return async (params: SendMessageParams) => {
    const state = get();
    const { context, hooks, displayMessages } = state;

    // ===== Hook: onBeforeSendMessage =====
    if (hooks.onBeforeSendMessage) {
      const result = await hooks.onBeforeSendMessage(params);
      if (result === false) {
        console.info('[ConversationStore] sendMessage blocked by onBeforeSendMessage hook');
        return;
      }
    }

    // Keep ConversationStore in sync with the editor, which is cleared immediately on send.
    // Do this before awaiting the full streaming lifecycle so drafts typed during generation
    // are not overwritten when the request completes.
    set({ inputMessage: '' });

    // Get global chat store
    const chatStore = useChatStore.getState();
    const messages = (params.messages ?? displayMessages).filter(
      (message) => !isLocalOnlyMessage(message),
    );

    // Forward to ChatStore.sendMessage with context and messages
    // Pass displayMessages to decouple sendMessage from store selectors
    // `onTopicCreated` is invoked from inside ChatStore.sendMessage as soon as
    // the backend reports a new topic id (only under isolatedTopic contexts),
    // not here after the full streaming lifecycle — otherwise the isolated
    // UI would not see the AI response while it is still streaming.
    const result = await chatStore.sendMessage({
      ...params,
      context,
      messages,
      onTopicCreated: hooks.onTopicCreated,
      onSendError: () => {
        const current = get();
        const editor = state.editor;
        const fileState = useFileStore.getState();
        // A delayed failure must never overwrite a newer draft or another
        // conversation's editor / attachments.
        if (
          !editor ||
          current.editor !== editor ||
          useChatStore.getState().mainInputEditor !== editor ||
          messageMapKey(current.context) !== messageMapKey(context) ||
          current.inputMessage.trim() ||
          editor.getMarkdownContent().trim() ||
          fileState.chatUploadFileList.length > 0 ||
          fileState.chatContextSelections.length > 0
        )
          return;

        if (params.editorData) editor.setJSONState(params.editorData);
        else editor.setDocument('markdown', params.message);
        set({ inputMessage: params.message });
        useFileStore.setState({
          chatContextSelections:
            params.contexts ??
            params.pageSelections?.map((selection) => ({
              content: selection.xml ?? selection.content,
              format: selection.xml === undefined ? ('markdown' as const) : ('xml' as const),
              id: selection.id,
              pageId: selection.pageId,
              preview: selection.content,
              type: 'text' as const,
            })) ??
            [],
          chatUploadFileList: params.files ?? [],
        });
      },
    });

    // ===== Hook: onAfterMessageCreate =====
    // Called after messages are created but before AI response is complete
    if (result && hooks.onAfterMessageCreate) {
      await hooks.onAfterMessageCreate({
        assistantMessageId: result.assistantMessageId,
        createdThreadId: result.createdThreadId,
        userMessageId: result.userMessageId,
      });
    }

    // ===== Hook: onAfterSendMessage =====
    if (hooks.onAfterSendMessage) {
      await hooks.onAfterSendMessage();
    }
  };
};
