import type { ConversationContext, ConversationFeatures } from '@lobechat/types';
import isEqual from 'fast-deep-equal';

import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { useChatStore } from '@/store/chat';
import { topicMapKey } from '@/store/chat/utils/topicMapKey';

const EMPTY_FEATURES: ConversationFeatures = {};

export const useConversationFeatures = (agentId: string, context?: ConversationContext) => {
  const defaults = useAgentStore(
    (state) =>
      agentByIdSelectors.getAgentConfigById(agentId)(state)?.chatConfig?.conversationFeatures ??
      EMPTY_FEATURES,
    isEqual,
  );
  const overrides = useChatStore((state) => {
    if (!context?.topicId) return EMPTY_FEATURES;
    const detail = state.conversationFeatureDetailMap[context.topicId];
    if (detail) return detail.features;
    const key = topicMapKey({ agentId: context.agentId, groupId: context.groupId });
    return (
      state.topicDataMap[key]?.items.find((topic) => topic.id === context.topicId)?.metadata
        ?.conversationFeatures ?? EMPTY_FEATURES
    );
  }, isEqual);
  return { ...defaults, ...overrides };
};
