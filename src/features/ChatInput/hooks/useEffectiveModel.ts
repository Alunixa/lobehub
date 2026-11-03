'use client';

import { useEffect } from 'react';

import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { useChatStore } from '@/store/chat';
// Import from the topic slice directly (not the `@/store/chat/selectors` barrel)
// to keep this hook's import graph small — it is pulled into many ChatInput
// controls, and the barrel drags in unrelated slice selectors.
import { topicSelectors } from '@/store/chat/slices/topic/selectors';

import { useTopicId } from './useTopicId';

interface ModelAndProvider {
  model: string;
  provider: string;
}

/**
 * The effective model/provider for ChatInput: the active topic's pinned model
 * when one exists, otherwise the agent default.
 *
 * Use this everywhere a capability is gated on the model that will actually run
 * (vision/upload, tool use, builtin search, context window, …) so the controls
 * stay in sync with the topic model after a switch — not the stale agent
 * default. The Model/ModelLabel controls resolve display + switch routing
 * against the same topic model (see `useAgentModelSelection` composition there).
 */
export const useEffectiveModel = (agentId: string): ModelAndProvider => {
  const [agentModel, agentProvider] = useAgentStore((s) => [
    agentByIdSelectors.getAgentModelById(agentId)(s),
    agentByIdSelectors.getAgentModelProviderById(agentId)(s),
  ]);

  const topicId = useTopicId();
  const topicModel = useChatStore((s) =>
    topicId ? topicSelectors.getTopicModelById(topicId)(s) : s.newTopicModelMap[agentId],
  );
  const useFetchTopicModel = useChatStore((s) => s.useFetchTopicModel);
  useFetchTopicModel(topicId);

  // Route hydration and browser back/forward can bypass switchTopic. Remember
  // the active conversation's choice too, without modifying the shared Agent.
  useEffect(() => {
    const state = useChatStore.getState();
    if (
      topicId &&
      topicModel &&
      state.activeTopicId === topicId &&
      state.activeAgentId === agentId
    ) {
      state.setNewTopicModel(agentId, topicModel);
    }
  }, [agentId, topicId, topicModel?.model, topicModel?.provider]);

  return {
    model: topicModel?.model || agentModel,
    provider: topicModel?.model ? topicModel.provider : agentProvider,
  };
};
