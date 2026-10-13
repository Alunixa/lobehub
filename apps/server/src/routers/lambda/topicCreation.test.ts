// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCallerFactory } from '@/libs/trpc/lambda';
import { createContextInner } from '@/libs/trpc/lambda/context';

import { topicRouter } from './topic';

const createTopic = vi.hoisted(() => vi.fn());
const database = vi.hoisted(() => ({
  select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
}));
vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn().mockResolvedValue(database),
}));
vi.mock('@/database/models/topic', () => ({
  TopicModel: class {
    create = createTopic;
  },
}));

describe('topic create RPC persists resolved assistant identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createTopic.mockResolvedValue({ id: 'topic' });
  });
  it('retains an explicit agent ID even when there is no legacy session mapping', async () => {
    const caller = createCallerFactory(topicRouter)(await createContextInner({ userId: 'user' }));
    expect(await caller.createTopic({ agentId: 'agent', title: 'Test' })).toBe('topic');
    expect(createTopic).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'agent',
        sessionId: null,
      }),
    );
  });
  it('retains a session-only topic without inventing an assistant identity', async () => {
    const caller = createCallerFactory(topicRouter)(await createContextInner({ userId: 'user' }));
    await caller.createTopic({ sessionId: 'session', title: 'Test' });
    expect(createTopic).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: null,
        sessionId: 'session',
      }),
    );
  });
});
