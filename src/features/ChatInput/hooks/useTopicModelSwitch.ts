import { useCallback } from 'react';

import { message } from '@/components/AntdStaticMethods';
import { useChatStore } from '@/store/chat';
import type { TopicModelSelection } from '@/store/chat/slices/topic/model';

import { useAgentId } from './useAgentId';
import { useEffectiveModel } from './useEffectiveModel';
import { useTopicId } from './useTopicId';

export const useTopicModelSwitch = () => {
  const agentId = useAgentId();
  const topicId = useTopicId();
  const selection = useEffectiveModel(agentId);
  const [updateTopicModel, setNewTopicModel] = useChatStore((s) => [
    s.updateTopicModel, s.setNewTopicModel,
  ]);
  const switchModel = useCallback(async (value: TopicModelSelection) => {
    try {
      if (topicId) await updateTopicModel(topicId, value);
      else setNewTopicModel(agentId, value);
    } catch (error) {
      console.error('[topic-model] Failed to save selection:', error);
      message.error(error instanceof Error ? error.message : String(error));
    }
  }, [agentId, topicId, updateTopicModel, setNewTopicModel]);
  return { ...selection, switchModel };
};
