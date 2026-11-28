import { useEffect, useRef } from 'react';

import { useEnabledChatModels } from '@/hooks/useEnabledChatModels';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { useAiInfraStore } from '@/store/aiInfra';
import { useChatStore } from '@/store/chat';
import { useHomeStore } from '@/store/home';
import { useUserStore } from '@/store/user';
import { settingsSelectors } from '@/store/user/selectors';

import { resolveHomeModel } from './selection';

export const useHomeModelFallback = (agentId?: string) => {
  const models = useEnabledChatModels();
  const ready = useAiInfraStore((s) => s.isInitAiProviderRuntimeState);
  const [model, provider, heterogeneous, loaded, update] = useAgentStore((s) => [
    agentByIdSelectors.getAgentModelById(agentId ?? '')(s),
    agentByIdSelectors.getAgentModelProviderById(agentId ?? '')(s),
    agentByIdSelectors.isAgentHeterogeneousById(agentId ?? '')(s),
    !!s.agentMap[agentId ?? ''],
    s.updateAgentConfigById,
  ]);
  const draft = useChatStore((s) => s.newTopicModelMap[agentId ?? '']);
  const preferred = useUserStore(settingsSelectors.defaultAgentConfig);
  const userReady = useUserStore((s) => s.isUserStateInit);
  const agentsReady = useHomeStore((s) => s.isAgentListInit);
  const current = draft ?? { model, provider };
  const resolved = resolveHomeModel(ready && loaded && userReady && agentsReady, models, current, {
    model: preferred.model,
    provider: preferred.provider ?? '',
  });
  const pending = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!agentId || heterogeneous || !resolved) return;
    if (resolved.model === current.model && resolved.provider === current.provider) return;
    const key = `${agentId}:${resolved.provider}:${resolved.model}`;
    if (pending.current === key) return;
    pending.current = key;
    useChatStore.getState().setNewTopicModel(agentId, resolved);
    void update(agentId, resolved).catch((error) => {
      pending.current = undefined;
      console.error('[home-model] Failed to persist fallback', error);
    });
  }, [
    agentId,
    heterogeneous,
    current.model,
    current.provider,
    resolved?.model,
    resolved?.provider,
    update,
  ]);
  return (
    loaded &&
    agentsReady &&
    userReady &&
    (heterogeneous ||
      (!!resolved && resolved.model === current.model && resolved.provider === current.provider))
  );
};
