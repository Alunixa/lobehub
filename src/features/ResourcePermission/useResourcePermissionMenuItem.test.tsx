/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useResourcePermissionMenuItem } from './useResourcePermissionMenuItem';

const permissionMock = vi.hoisted(() => ({
  data: {
    accessLevel: 'view',
    canManage: false,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: { children: React.ReactNode }) => children,
  Icon: () => null,
}));

vi.mock('./useResourcePermission', () => ({
  useResourcePermission: () => ({
    data: permissionMock.data,
    error: undefined,
    isLoading: false,
    setAccessLevel: vi.fn(),
    updating: false,
  }),
}));

describe('useResourcePermissionMenuItem', () => {
  beforeEach(() => {
    permissionMock.data = {
      accessLevel: 'view',
      canManage: false,
    };
  });

  it('keeps non-manageable permissions hidden by default', () => {
    const { result } = renderHook(() => useResourcePermissionMenuItem('document', 'doc-1'));

    expect(result.current).toBeNull();
  });

  it('shows the current permission as a disabled overflow item when requested', () => {
    const { result } = renderHook(() =>
      useResourcePermissionMenuItem('document', 'doc-1', { showReadOnly: true }),
    );

    expect(result.current).toMatchObject({
      disabled: true,
      key: 'member-permissions',
      label: 'permission.generalAccess.trigger',
    });
  });
});
