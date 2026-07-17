// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertCanPerformResourceAction,
  getResourceMeta,
} from '@/server/services/resourcePermission';

import {
  assertCanUseConversationTargets,
  assertCanUseMessageTargets,
  assertCanUseTopicTargets,
} from './conversationResourceGuard';

vi.mock('@/server/services/resourcePermission', () => ({
  assertCanPerformResourceAction: vi.fn(),
  getResourceMeta: vi.fn(),
}));

const getResourceMetaMock = vi.mocked(getResourceMeta);
const assertActionMock = vi.mocked(assertCanPerformResourceAction);

/** Minimal drizzle stub: every select().from().where() resolves `rows`. */
const createDb = (rowsPerCall: any[][]) => {
  let call = 0;
  return {
    select: () => ({
      from: () => ({
        where: async () => rowsPerCall[call++] ?? [],
      }),
    }),
  } as any;
};

const baseCtx = (db: any, workspaceId: string | null = 'ws-1') => ({
  db,
  userId: 'user-1',
  workspaceId,
});

const wsMeta = { userId: 'creator', visibility: 'public', workspaceId: 'ws-1' };

beforeEach(() => {
  vi.clearAllMocks();
  getResourceMetaMock.mockResolvedValue(wsMeta as any);
});

describe('assertCanUseConversationTargets', () => {
  it('no-ops in personal mode', async () => {
    await assertCanUseConversationTargets(baseCtx(createDb([]), null), [{ agentId: 'agent-1' }]);

    expect(getResourceMetaMock).not.toHaveBeenCalled();
    expect(assertActionMock).not.toHaveBeenCalled();
  });

  it('asserts `use` on the agent of each deduped target', async () => {
    await assertCanUseConversationTargets(baseCtx(createDb([])), [
      { agentId: 'agent-1' },
      { agentId: 'agent-1' },
    ]);

    expect(assertActionMock).toHaveBeenCalledTimes(1);
    expect(assertActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'use',
        resourceId: 'agent-1',
        resourceType: 'agent',
        userId: 'user-1',
        workspaceId: 'ws-1',
      }),
    );
  });

  it('prefers the group over the agent for group conversations', async () => {
    await assertCanUseConversationTargets(baseCtx(createDb([])), [
      { agentId: 'supervisor-1', groupId: 'group-1' },
    ]);

    expect(assertActionMock).toHaveBeenCalledTimes(1);
    expect(assertActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 'group-1', resourceType: 'agentGroup' }),
    );
  });

  it('skips resources that do not belong to the current workspace', async () => {
    getResourceMetaMock.mockResolvedValueOnce({ ...wsMeta, workspaceId: 'other-ws' } as any);

    await assertCanUseConversationTargets(baseCtx(createDb([])), [{ agentId: 'agent-1' }]);

    expect(assertActionMock).not.toHaveBeenCalled();
  });

  it('propagates FORBIDDEN from the permission assert', async () => {
    assertActionMock.mockRejectedValueOnce(new TRPCError({ code: 'FORBIDDEN' }));

    await expect(
      assertCanUseConversationTargets(baseCtx(createDb([])), [{ agentId: 'agent-1' }]),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('assertCanUseMessageTargets', () => {
  it('resolves the owning agent from the message rows', async () => {
    const db = createDb([[{ agentId: 'agent-1', groupId: null, topicId: 't-1' }]]);

    await assertCanUseMessageTargets(baseCtx(db), ['msg-1']);

    expect(assertActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 'agent-1', resourceType: 'agent' }),
    );
  });

  it('falls back to the topic linkage when the row has no agent/group', async () => {
    const db = createDb([
      [{ agentId: null, groupId: null, topicId: 't-1' }],
      [{ agentId: 'agent-2', groupId: null }],
    ]);

    await assertCanUseMessageTargets(baseCtx(db), ['msg-1']);

    expect(assertActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 'agent-2', resourceType: 'agent' }),
    );
  });

  it('no-ops without ids or workspace', async () => {
    await assertCanUseMessageTargets(baseCtx(createDb([]), null), ['msg-1']);
    await assertCanUseMessageTargets(baseCtx(createDb([])), []);

    expect(assertActionMock).not.toHaveBeenCalled();
  });
});

describe('assertCanUseTopicTargets', () => {
  it('resolves the owning group from the topic rows', async () => {
    const db = createDb([[{ agentId: null, groupId: 'group-1' }]]);

    await assertCanUseTopicTargets(baseCtx(db), ['t-1']);

    expect(assertActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 'group-1', resourceType: 'agentGroup' }),
    );
  });
});
