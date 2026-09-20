import { App } from 'antd';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { usePermission } from '@/hooks/usePermission';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import {
  dataSelectors,
  messageStateSelectors,
  useConversationStore,
  useConversationStoreApi,
} from '../store';

export const useInsertContext = (id: string) => {
  const { t } = useTranslation('chat');
  const { message } = App.useApp();
  const api = useConversationStoreApi();
  const userId = useUserStore(userProfileSelectors.userId);
  const { allowed: canCreate } = usePermission('create_content');
  const { allowed: canEdit } = usePermission('edit_own_content');
  const disabled = useConversationStore(
    (s) => !s.context.topicId || messageStateSelectors.isInputLoading(s),
  );
  const open = useCallback(async () => {
    const state = api.getState();
    if (!canCreate || !canEdit) return;
    if (!state.context.topicId || messageStateSelectors.isInputLoading(state)) {
      message.warning(t('messageContent.waitForResponse'));
      return;
    }
    const item = dataSelectors.getDisplayMessageById(id)(state);
    if (!item) return;
    // Virtual groups use their first real message as a stable server-side anchor.
    const anchorId = item.children?.[0]?.id ?? item.id;
    try {
      const { openContextMessageEditor } =
        await import('@/features/MessageContentEditor/ContextMessageEditor');
      openContextMessageEditor({
        anchorId,
        draftKey: `lobehub:context:${userId}:${state.context.topicId}:${state.context.threadId ?? 'main'}:${anchorId}`,
        onSave: state.insertContextMessage,
      });
    } catch (error) {
      console.error('Failed to open context editor:', error);
      message.error(t('messageContent.saveFailed'));
    }
  }, [api, canCreate, canEdit, id, message, t, userId]);
  return { disabled: disabled || !canCreate || !canEdit, open };
};
