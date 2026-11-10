import type { SystemAgentItem } from '@lobechat/types';
import { resolveConversationImageModel } from '@lobechat/utils/conversationImageModel';
import { useRef, useState } from 'react';

import { useAiInfraStore } from '@/store/aiInfra';
import { aiProviderSelectors } from '@/store/aiInfra/selectors';

interface FieldState {
  draft?: SystemAgentItem;
  error?: unknown;
  status: 'idle' | 'saving' | 'saved' | 'failed';
}

export const useConversationImageModelField = ({
  disabled,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (value: Partial<SystemAgentItem>) => Promise<void>;
  value: SystemAgentItem;
}) => {
  const [state, setState] = useState<FieldState>({ status: 'idle' });
  const saving = useRef(false);
  const [models, initialized] = useAiInfraStore((s) => [
    aiProviderSelectors.enabledImageModelList(s),
    s.isInitAiProviderRuntimeState,
  ]);
  const selection = resolveConversationImageModel(state.draft ?? value);
  const unavailable = !!(
    initialized &&
    selection &&
    !models.some(
      (provider) =>
        provider.id === selection.provider &&
        provider.children.some((model) => model.id === selection.model),
    )
  );

  const save = async (next: SystemAgentItem) => {
    if (disabled || saving.current) return;
    saving.current = true;
    setState({ draft: next, status: 'saving' });
    try {
      await onChange(next);
      setState({ status: 'saved' });
    } catch (error) {
      console.error('[service-model:conversation-image] Failed to save model selection', error);
      setState({ draft: next, error, status: 'failed' });
    } finally {
      saving.current = false;
    }
  };

  return {
    ...state,
    empty: initialized && models.length === 0,
    retry: async () => {
      if (!disabled && state.draft) await save(state.draft);
    },
    save,
    selection,
    unavailable,
  };
};
