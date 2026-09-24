'use client';

import type { ConversationContext } from '@lobechat/types';
import { memo, useEffect, useRef } from 'react';

import { mutate } from '@/libs/swr';
import { messageKeys } from '@/libs/swr/keys';
import { subscribeToMessageUpdates } from '@/services/realtime/messageSubscription';
import { getChatStoreState, useChatStore } from '@/store/chat';
import { operationSelectors } from '@/store/chat/selectors';

interface MessageRealtimeSyncProps {
  context: ConversationContext;
  disabled?: boolean;
}

const MessageRealtimeSync = memo<MessageRealtimeSyncProps>(({ context, disabled }) => {
  const pendingRefresh = useRef(false);
  const isStreaming = useChatStore(operationSelectors.isAgentRuntimeRunningByContext(context));
  const canSubscribe =
    !disabled &&
    !context.isNew &&
    !context.topicShareId &&
    Boolean(context.agentId && context.topicId);

  useEffect(() => {
    if (!canSubscribe) return;

    const refresh = () => {
      if (operationSelectors.isAgentRuntimeRunningByContext(context)(getChatStoreState())) {
        pendingRefresh.current = true;
        return;
      }

      pendingRefresh.current = false;
      void mutate(messageKeys.list(context));
    };

    return subscribeToMessageUpdates(context, {
      onReconnect: refresh,
      onUpdate: refresh,
    });
  }, [canSubscribe, context]);

  useEffect(() => {
    if (isStreaming || !pendingRefresh.current || !canSubscribe) return;

    pendingRefresh.current = false;
    void mutate(messageKeys.list(context));
  }, [canSubscribe, context, isStreaming]);

  return null;
});

MessageRealtimeSync.displayName = 'MessageRealtimeSync';

export default MessageRealtimeSync;
