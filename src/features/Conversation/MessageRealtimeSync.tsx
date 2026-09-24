'use client';

import type { ConversationContext } from '@lobechat/types';
import { memo, useEffect, useMemo, useRef } from 'react';

import { useEventCallback } from '@/hooks/useEventCallback';
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
  const subscriptionContext = useMemo(
    () => ({
      agentId: context.agentId,
      groupId: context.groupId,
      sessionId: context.sessionId,
      threadId: context.threadId,
      topicId: context.topicId,
    }),
    [context.agentId, context.groupId, context.sessionId, context.threadId, context.topicId],
  );
  const canSubscribe =
    !disabled &&
    !context.isNew &&
    !context.topicShareId &&
    Boolean(context.agentId && context.topicId);
  const refresh = useEventCallback(() => {
    if (operationSelectors.isAgentRuntimeRunningByContext(context)(getChatStoreState())) {
      pendingRefresh.current = true;
      return;
    }

    pendingRefresh.current = false;
    void mutate(messageKeys.list(context));
  });

  useEffect(() => {
    if (!canSubscribe) return;

    return subscribeToMessageUpdates(subscriptionContext, {
      onReconnect: refresh,
      onUpdate: refresh,
    });
  }, [canSubscribe, refresh, subscriptionContext]);

  useEffect(() => {
    if (isStreaming || !pendingRefresh.current || !canSubscribe) return;

    refresh();
  }, [canSubscribe, isStreaming, refresh]);

  return null;
});

MessageRealtimeSync.displayName = 'MessageRealtimeSync';

export default MessageRealtimeSync;
