import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAgentRuntimeRedisClient } from '@/server/modules/AgentRuntime/redis';

import {
  getMessageRealtimeConversationChannel,
  getMessageRealtimeSubscriptionChannels,
  publishMessageRealtimeUpdate,
} from './realtime';

vi.mock('@/server/modules/AgentRuntime/redis', () => ({
  getAgentRuntimeRedisClient: vi.fn(),
}));

describe('message realtime channels', () => {
  const previousRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (previousRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previousRedisUrl;
  });

  it('uses a shared workspace channel across workspace members', () => {
    const context = { agentId: 'agent-1', topicId: 'topic-1' };
    const first = getMessageRealtimeConversationChannel(
      { userId: 'user-1', workspaceId: 'workspace-1' },
      context,
    );
    const second = getMessageRealtimeConversationChannel(
      { userId: 'user-2', workspaceId: 'workspace-1' },
      context,
    );

    expect(first).toBe(second);
  });

  it('isolates personal channels and normalizes group conversations by group', () => {
    const personalA = getMessageRealtimeConversationChannel(
      { userId: 'user-1' },
      { agentId: 'agent-1', topicId: 'topic-1' },
    );
    const personalB = getMessageRealtimeConversationChannel(
      { userId: 'user-2' },
      { agentId: 'agent-1', topicId: 'topic-1' },
    );
    const groupA = getMessageRealtimeConversationChannel(
      { userId: 'user-1' },
      { agentId: 'agent-1', groupId: 'group-1', topicId: 'topic-1' },
    );
    const groupB = getMessageRealtimeConversationChannel(
      { userId: 'user-1' },
      { agentId: 'agent-2', groupId: 'group-1', topicId: 'topic-1' },
    );

    expect(personalA).not.toBe(personalB);
    expect(groupA).toBe(groupB);
    expect(getMessageRealtimeSubscriptionChannels({ userId: 'user-1' }, {})).toEqual([]);
  });

  it('publishes a lightweight invalidation event without exposing context', async () => {
    process.env.REDIS_URL = 'redis://test.invalid:6379';
    const publish = vi.fn().mockResolvedValue(1);
    vi.mocked(getAgentRuntimeRedisClient).mockReturnValue({ publish } as any);

    await publishMessageRealtimeUpdate(
      { userId: 'user-1' },
      { agentId: 'agent-1', topicId: 'topic-1' },
      'edit',
    );

    expect(publish).toHaveBeenCalledTimes(1);
    const [channel, rawEvent] = publish.mock.calls[0];
    expect(channel).toMatch(/^lobe:messages:v1:conversation:/);
    expect(JSON.parse(rawEvent)).toEqual(
      expect.objectContaining({ reason: 'edit', type: 'messages.updated' }),
    );
    expect(rawEvent).not.toContain('topic-1');
    expect(rawEvent).not.toContain('agent-1');
  });
});
