import type { ConversationContext, ConversationFeatures } from '@lobechat/types';
import { useEffect, useRef, useState } from 'react';

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
  const pendingRef = useRef<Partial<ConversationFeatures>>({});
  const sequence = useRef(0);
  const writes = useRef(Promise.resolve());
  const scope = `${agentId}:${context?.topicId ?? ''}`;
  useEffect(() => {
    sequence.current++;
    pendingRef.current = {};
    setPending({});
    setSaveState('idle');
  }, [scope]);

  const savePatch = async (patch: Partial<ConversationFeatures>) => {
    const version = ++sequence.current;
    pendingRef.current = { ...pendingRef.current, ...patch };
    const changes = { ...pendingRef.current };
    const desired = { ...features, ...pendingRef.current };
    setPending(pendingRef.current);
    setSaveState('saving');
    // Start permission enrollment inside the user's gesture, before any RPC awaits.
    const push =
      patch.proactiveNotifications === true
        ? capabilities.data?.webPushPublicKey
          ? conversationFeatureService.enableBrowserPush().then(
              () => true,
              () => false,
            )
          : Promise.resolve(false)
        : undefined;
    const write = async () => {
      try {
        if (context?.topicId && !context.isNew) {
          await updateConversationFeatures(context, changes);
        } else {
          await updateAgentChatConfig({ conversationFeatures: desired });
        }
        const pushAvailable = push ? await push : undefined;
        if (version === sequence.current) {
          if (pushAvailable !== undefined) setPushUnavailable(!pushAvailable);
          pendingRef.current = {};
          setPending({});
          setSaveState('saved');
        }
      } catch (error) {
        console.error('[ConversationFeatures] Settings were not saved:', (error as Error).name);
        if (version === sequence.current) setSaveState('failed');
      }
    };
    const task = writes.current.then(write);
    writes.current = task;
    await task;
  };
  const save = <K extends keyof ConversationFeatures>(key: K, value: ConversationFeatures[K]) =>
    savePatch({ [key]: value });
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
    retry: () => void savePatch(pending),
  };
};
