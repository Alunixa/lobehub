import type { ConversationContext } from '@lobechat/types';

import type { ChatStore } from '@/store/chat/store';

/**
 * Clear an isolated send's source bucket after its messages are persisted under
 * the new topic, so a later blank send cannot adopt those rows again.
 */
export const clearBlankConversationBucket = (
  get: () => ChatStore,
  { agentId, groupId, scope }: Pick<ConversationContext, 'agentId' | 'groupId' | 'scope'>,
) =>
  get().replaceMessages([], {
    action: 'clearBlankConversationBucket',
    context: {
      agentId,
      groupId,
      scope: scope ?? (groupId ? 'group' : 'main'),
      topicId: null,
    },
  });

/**
 * Leave the blank bucket a successful send came from. Isolated sends stay in
 * their host view and only clear that source bucket; regular sends navigate to
 * the new topic only if the user is still in the conversation that sent them.
 */
export const leaveBlankConversationBucket = async (
  get: () => ChatStore,
  context: Pick<ConversationContext, 'agentId' | 'groupId' | 'scope' | 'topicId'>,
  { isolated, topicId }: { isolated?: boolean; topicId: string },
) => {
  if (isolated) return clearBlankConversationBucket(get, context);

  const store = get();
  const activeTopicId = store.activeTopicId ?? null;
  const sourceTopicId = context.topicId ?? null;

  if (
    store.activeAgentId !== context.agentId ||
    store.activeGroupId !== context.groupId ||
    (activeTopicId !== sourceTopicId && activeTopicId !== topicId)
  ) {
    return;
  }

  await store.switchTopic(topicId, {
    clearNewKey: true,
    scope: context.scope ?? (context.groupId ? 'group' : 'main'),
    skipRefreshMessage: true,
  });
};
