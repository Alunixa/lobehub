import { useCallback, useRef } from 'react';

import { message } from '@/components/AntdStaticMethods';
import { useAgentStore } from '@/store/agent';
import { useChatStore } from '@/store/chat';
import type { TopicModelSelection } from '@/store/chat/slices/topic/model';

import { useChatInputStore } from '../store';
import { useAgentId } from './useAgentId';
import { useEffectiveModel } from './useEffectiveModel';
import { useTopicId } from './useTopicId';

export const useTopicModelSwitch = () => {
  const agentId = useAgentId();
  const topicId = useTopicId();
  const selection = useEffectiveModel(agentId);
  const persistNewTopicModel = useChatInputStore((s) => s.persistNewTopicModel);
  const updateAgentConfigById = useAgentStore((s) => s.updateAgentConfigById);
  const selectionVersion = useRef(0);
  const [updateTopicModel, setNewTopicModel] = useChatStore((s) => [
    s.updateTopicModel,
    s.setNewTopicModel,
  ]);
  const switchModel = useCallback(
    async (value: TopicModelSelection) => {
      const version = ++selectionVersion.current;
      try {
        if (topicId) await updateTopicModel(topicId, value);
        else {
          if (persistNewTopicModel) await updateAgentConfigById(agentId, value);
          if (version === selectionVersion.current) setNewTopicModel(agentId, value);
        }
      } catch (error) {
        console.error('[topic-model] Failed to save selection:', error);
        message.error(error instanceof Error ? error.message : String(error));
      }
    },
    [
      agentId,
      topicId,
      updateTopicModel,
      setNewTopicModel,
      persistNewTopicModel,
      updateAgentConfigById,
    ],
  );
  return { ...selection, switchModel };
};
