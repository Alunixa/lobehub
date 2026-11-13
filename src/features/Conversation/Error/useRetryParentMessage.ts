import { useCallback, useState } from 'react';

import { useConversationStore } from '@/features/Conversation/store';

type BeforeRetry = () => Promise<void> | void;

export const useRetryParentMessage = (id: string, parentIdOverride?: string) => {
  const [loading, setLoading] = useState(false);

  const regenerateUserMessage = useConversationStore((s) => s.regenerateUserMessage);
  const parentId = useConversationStore(
    (s) => parentIdOverride ?? s.displayMessages.find((m) => m.id === id)?.parentId,
  );

  const retryParentMessage = useCallback(
    async (beforeRetry?: BeforeRetry) => {
      if (!parentId) return;

      setLoading(true);
      try {
        await beforeRetry?.();
        await regenerateUserMessage(parentId);
      } finally {
        setLoading(false);
      }
    },
    [parentId, regenerateUserMessage],
  );

  return {
    disabled: !parentId,
    loading,
    retryParentMessage,
  };
};
