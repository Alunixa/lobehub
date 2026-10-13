import type { ConversationContext, ConversationFeatures } from '@lobechat/types';
import { useState } from 'react';

import { conversationFeatureService } from '@/services/conversationFeatures';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { useChatStore } from '@/store/chat';

import { useAgentId } from '../../hooks/useAgentId';
import { useConversationFeatures } from '../../hooks/useConversationFeatures';
import { useUpdateAgentConfig } from '../../hooks/useUpdateAgentConfig';
import { useChatInputStore } from '../../store';

export const useConversationFeatureControls = () => {
  const agentId = useAgentId();
  const inputContext = useChatInputStore((state) => state.conversationContext);
  const fallbackContext = useChatStore((state) =>
    state.activeAgentId === agentId
      ? {
          agentId,
          groupId: state.activeGroupId,
          topicId: state.activeTopicId,
          scope: 'main' as const,
        }
      : undefined,
  );
  const context: ConversationContext | undefined = inputContext ?? fallbackContext;
  const features = useConversationFeatures(agentId, context);
  const { updateAgentChatConfig } = useUpdateAgentConfig();
  const updateConversationFeatures = useChatStore((state) => state.updateConversationFeatures);
  const useFetchCapabilities = useChatStore(
    (state) => state.useFetchConversationFeatureCapabilities,
  );
  const useFetchDetail = useChatStore((state) => state.useFetchConversationFeatureDetail);
  const providerId = useAgentStore(agentByIdSelectors.getAgentModelProviderById(agentId));
  const capabilities = useFetchCapabilities(providerId ?? undefined);
  const detail = useFetchDetail(context?.isNew ? undefined : (context?.topicId ?? undefined));
  const plan = useChatStore((state) =>
    context?.topicId ? state.conversationFeatureDetailMap[context.topicId]?.plan : undefined,
  );
  const isCli = useAgentStore((state) =>
    Boolean(
      agentByIdSelectors.getAgentConfigById(agentId)(state)?.agencyConfig?.heterogeneousProvider
        ?.type,
    ),
  );
  const [pending, setPending] = useState<Partial<ConversationFeatures>>({});
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [pushUnavailable, setPushUnavailable] = useState(false);

  const save = async (key: keyof ConversationFeatures, checked: boolean) => {
    setPending({ [key]: checked });
    setSaveState('saving');
    // Start permission enrollment inside the user's gesture, before any RPC awaits.
    const push =
      key === 'proactiveNotifications' && checked
        ? capabilities.data?.webPushPublicKey
          ? conversationFeatureService.enableBrowserPush().then(
              () => true,
              () => false,
            )
          : Promise.resolve(false)
        : undefined;
    try {
      if (context?.topicId && !context.isNew) {
        await updateConversationFeatures(context, { [key]: checked });
      } else {
        await updateAgentChatConfig({ conversationFeatures: { ...features, [key]: checked } });
      }
      if (push) setPushUnavailable(!(await push));
      setPending({});
      setSaveState('saved');
    } catch (error) {
      console.error('[ConversationFeatures] Settings were not saved:', (error as Error).name);
      setSaveState('failed');
    }
  };
  return {
    capabilities,
    context,
    detail,
    isCli,
    plan,
    pushUnavailable,
    saveState,
    current: { ...features, ...pending },
    save,
    retry: () => {
      const [key, value] = Object.entries(pending)[0] ?? [];
      if (key) void save(key as keyof ConversationFeatures, Boolean(value));
    },
  };
};
