// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TransferErrorCode } from '@/types/transferError';

const mocks = vi.hoisted(() => ({
  assertCanPerformResourceAction: vi.fn(),
  businessFileTransferStorageCheck: vi.fn(),
  countFileUsageInSubtree: vi.fn(),
  findById: vi.fn(),
  subtreeHasForeignRows: vi.fn(),
  transferTo: vi.fn(),
}));

vi.mock('@/business/server/lambda-routers/file', () => ({
  businessFileTransferStorageCheck: mocks.businessFileTransferStorageCheck,
}));
vi.mock('@/database/models/chunk', () => ({ ChunkModel: vi.fn(() => ({})) }));
vi.mock('@/database/models/document', () => ({
  DocumentModel: vi.fn(() => ({
    countFileUsageInSubtree: mocks.countFileUsageInSubtree,
    findById: mocks.findById,
    subtreeHasForeignRows: mocks.subtreeHasForeignRows,
    transferTo: mocks.transferTo,
  })),
}));
vi.mock('@/database/models/file', () => ({ FileModel: vi.fn(() => ({})) }));
vi.mock('@/database/models/message', () => ({ MessageModel: vi.fn(() => ({})) }));
vi.mock('@/database/models/resourcePermission', () => ({
  ResourcePermissionModel: vi.fn(() => ({ removeAll: vi.fn(), setAccessLevel: vi.fn() })),
}));
vi.mock('@/server/services/document', () => ({ DocumentService: vi.fn(() => ({})) }));
vi.mock('@/server/services/resourcePermission', () => ({
  assertCanEditResource: vi.fn(),
  assertCanPerformResourceAction: mocks.assertCanPerformResourceAction,
  buildResourcePermissionState: vi.fn(),
  getResourceMeta: vi.fn(),
}));
vi.mock('@/server/services/workspacePermission', () => ({
  hasWorkspaceScopedPermission: vi.fn(),
}));

const { documentRouter } = await import('../document');

describe('documentRouter transferDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertCanPerformResourceAction.mockResolvedValue(undefined);
    mocks.findById.mockResolvedValue({
      id: 'doc-1',
      userId: 'member-1',
      visibility: 'public',
      workspaceId: 'ws-1',
    });
    mocks.subtreeHasForeignRows.mockResolvedValue(false);
  });

  it('blocks a non-owner from transferring a tree containing foreign rows', async () => {
    mocks.subtreeHasForeignRows.mockResolvedValueOnce(true);
    const caller = documentRouter.createCaller({
      serverDB: {},
      userId: 'member-1',
      workspaceId: 'ws-1',
      workspaceRole: 'member',
    } as any);

    await expect(
      caller.transferDocument({ documentId: 'doc-1', targetWorkspaceId: null }),
    ).rejects.toMatchObject({
      cause: { data: { code: TransferErrorCode.OwnerOnly } },
      code: 'FORBIDDEN',
    });

    expect(mocks.subtreeHasForeignRows).toHaveBeenCalledWith('doc-1');
    expect(mocks.countFileUsageInSubtree).not.toHaveBeenCalled();
    expect(mocks.transferTo).not.toHaveBeenCalled();
  });
});
