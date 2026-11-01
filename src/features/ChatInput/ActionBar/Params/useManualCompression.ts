import type { ConversationContext } from '@lobechat/types';
import { useEffect, useRef, useState } from 'react';

import { messageService } from '@/services/message';
import { useChatStore } from '@/store/chat';
import { operationSelectors } from '@/store/chat/selectors';
import {
  getCompressionCandidateMessageIds,
  hasRunningCompressionOperation,
} from '@/store/chat/utils/compression';
import { messageMapKey } from '@/store/chat/utils/messageMapKey';

export const useManualCompression = (context: ConversationContext | undefined) => {
  const key = context ? messageMapKey(context) : '';
  const messages = useChatStore((s) => s.dbMessagesMap[key]);
  const operations = useChatStore((s) => s.operations);
  const generating = useChatStore((s) =>
    context ? operationSelectors.isInputLoadingByContext(context)(s) : false,
  );
  const [state, setState] = useState<
    'idle' | 'compressing' | 'undoing' | 'failed' | 'done' | 'restored'
  >('idle');
  const version = useRef(0);
  const cancelled = useRef(false);
  useEffect(() => {
    version.current++;
    setState('idle');
    return () => {
      version.current++;
    };
  }, [key]);
  const running = context && hasRunningCompressionOperation(Object.values(operations), context);
  const lastGroup = messages?.findLast((message) => message.role === 'compressedGroup');
  const canCompress = Boolean(
    context?.topicId && !context.isNew && getCompressionCandidateMessageIds(messages ?? []).length,
  );
  const busy = state === 'compressing' || state === 'undoing' || Boolean(running);
  const compress = async () => {
    if (!context || !canCompress || busy || generating) return;
    const current = ++version.current;
    cancelled.current = false;
    setState('compressing');
    try {
      await useChatStore.getState().executeCompression({ ...context }, '');
      if (current === version.current) setState(cancelled.current ? 'idle' : 'done');
    } catch {
      if (current === version.current) setState('failed');
    }
  };
  const undo = async () => {
    if (!context?.topicId || !lastGroup || busy || generating) return;
    const current = ++version.current;
    setState('undoing');
    try {
      const result = await messageService.cancelCompression({
        agentId: context.agentId,
        groupId: context.groupId,
        messageGroupId: lastGroup.id,
        threadId: context.threadId,
        topicId: context.topicId,
      });
      useChatStore.getState().replaceMessages(result.messages, { context });
      if (current === version.current) setState('restored');
    } catch {
      if (current === version.current) setState('failed');
    }
  };
  const cancel = () => {
    if (!context) return;
    for (const operation of Object.values(operations)) {
      if (hasRunningCompressionOperation([operation], context)) {
        useChatStore.getState().cancelOperation(operation.id, 'Manual compression cancelled');
      }
    }
    cancelled.current = true;
  };
  return {
    busy,
    canCompress,
    cancel,
    compress,
    generating,
    hasSummary: Boolean(lastGroup),
    state,
    undo,
  };
};
