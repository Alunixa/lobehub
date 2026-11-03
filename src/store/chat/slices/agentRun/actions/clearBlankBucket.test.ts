import { describe, expect, it, vi } from 'vitest';

import type { ChatStore } from '@/store/chat/store';

import { clearBlankConversationBucket, leaveBlankConversationBucket } from './clearBlankBucket';

const context = { agentId: 'agent-a', groupId: undefined, scope: 'main' as const, topicId: null };

const createGet = (overrides: Record<string, unknown> = {}) => {
  const state = {
    activeAgentId: 'agent-a',
    activeGroupId: undefined,
    activeTopicId: null,
    replaceMessages: vi.fn(),
    switchTopic: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  return { get: () => state as unknown as ChatStore, state };
};

describe('blank conversation bucket lifecycle', () => {
  it('clears only the source bucket for an isolated send without navigating', () => {
    const { get, state } = createGet({ activeAgentId: 'agent-b' });

    clearBlankConversationBucket(get, context);

    expect(state.replaceMessages).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        action: 'clearBlankConversationBucket',
        context: { agentId: 'agent-a', groupId: undefined, scope: 'main', topicId: null },
      }),
    );
    expect(state.switchTopic).not.toHaveBeenCalled();
  });

  it('opens the created topic only while the source conversation is still active', async () => {
    const { get, state } = createGet();

    await leaveBlankConversationBucket(get, context, { topicId: 'topic-new' });

    expect(state.switchTopic).toHaveBeenCalledWith('topic-new', {
      clearNewKey: true,
      scope: 'main',
      skipRefreshMessage: true,
    });
  });

  it('does not switch away after the user navigates to another conversation', async () => {
    const { get, state } = createGet({ activeTopicId: 'topic-other' });

    await leaveBlankConversationBucket(get, context, { topicId: 'topic-new' });

    expect(state.switchTopic).not.toHaveBeenCalled();
  });

  it('clears the isolated source bucket after notifying its host without changing topics', async () => {
    const { get, state } = createGet({ activeTopicId: 'topic-other' });

    await leaveBlankConversationBucket(get, context, { isolated: true, topicId: 'topic-new' });

    expect(state.replaceMessages).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        context: expect.objectContaining({ agentId: 'agent-a', topicId: null }),
      }),
    );
    expect(state.switchTopic).not.toHaveBeenCalled();
  });
});
