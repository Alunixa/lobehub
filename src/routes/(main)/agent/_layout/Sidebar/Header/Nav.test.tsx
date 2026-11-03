/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createContext, use } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Nav from './Nav';

const RouteContext = createContext(0);

const mutateMock = vi.hoisted(() => vi.fn());
const openNewTopicOrSaveTopicMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const switchTopicMock = vi.hoisted(() => vi.fn());
const toggleCommandMenuMock = vi.hoisted(() => vi.fn());
const useParamsMock = vi.hoisted(() => vi.fn());
const usePathnameMock = vi.hoisted(() => vi.fn());
const permissionMock = vi.hoisted(() => ({
  create_content: true,
}));

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock('@lobehub/ui/icons', () => ({
  BotPromptIcon: () => null,
}));

vi.mock('lucide-react', () => ({
  MessageSquarePlusIcon: () => null,
  MessagesSquareIcon: () => null,
  RadioTowerIcon: () => null,
  SearchIcon: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router', async () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = (await vi.importActual('react-router')) as typeof import('react-router');

  return {
    ...actual,
    useParams: useParamsMock,
  };
});

vi.mock('@/features/NavPanel/components/NavItem', () => ({
  default: ({
    active,
    disabled,
    onClick,
    title,
  }: {
    active?: boolean;
    disabled?: boolean;
    onClick?: () => void;
    title: ReactNode;
  }) => (
    <button data-active={String(active)} disabled={disabled} type="button" onClick={onClick}>
      {title}
    </button>
  ),
}));

vi.mock('@/hooks/useQueryRoute', () => ({
  useQueryRoute: () => ({
    push: pushMock,
  }),
}));

vi.mock('@/libs/router/navigation', () => ({
  usePathname: () => {
    use(RouteContext);
    return usePathnameMock();
  },
}));

vi.mock('@/libs/swr', () => ({
  useActionSWR: (_key: unknown, fetcher: () => Promise<boolean>) => {
    mutateMock.mockImplementation(fetcher);
    return { mutate: mutateMock };
  },
}));

vi.mock('@/hooks/usePermission', () => ({
  usePermission: (action: 'create_content') => ({
    allowed: permissionMock[action],
    reason: permissionMock[action] ? '' : 'requires member',
  }),
}));

vi.mock('@/store/agent', () => ({
  useAgentStore: (selector: (state: unknown) => unknown) => selector({}),
}));

vi.mock('@/store/agent/selectors', () => ({
  agentSelectors: {
    currentAgentHeterogeneousProviderType: () => undefined,
  },
}));

vi.mock('@/store/chat', () => ({
  useChatStore: (
    selector: (state: {
      openNewTopicOrSaveTopic: (options?: unknown) => Promise<boolean>;
      switchTopic: (topicId: string | null, options?: unknown) => void;
    }) => unknown,
  ) =>
    selector({
      openNewTopicOrSaveTopic: openNewTopicOrSaveTopicMock,
      switchTopic: switchTopicMock,
    }),
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: (state: { toggleCommandMenu: (open: boolean) => void }) => unknown) =>
    selector({ toggleCommandMenu: toggleCommandMenuMock }),
}));

vi.mock('@/store/serverConfig', () => ({
  featureFlagsSelectors: (state: { featureFlags: { isAgentEditable: boolean } }) =>
    state.featureFlags,
  useServerConfigStore: (
    selector: (state: { featureFlags: { isAgentEditable: boolean } }) => unknown,
  ) => selector({ featureFlags: { isAgentEditable: true } }),
}));

describe('Agent sidebar header nav', () => {
  beforeEach(() => {
    mutateMock.mockReset();
    openNewTopicOrSaveTopicMock.mockReset();
    pushMock.mockReset();
    switchTopicMock.mockReset();
    toggleCommandMenuMock.mockReset();
    useParamsMock.mockReset();
    usePathnameMock.mockReset();
    permissionMock.create_content = true;
    openNewTopicOrSaveTopicMock.mockResolvedValue(true);

    useParamsMock.mockReturnValue({ aid: 'agt_eH4zL98zBx5u', topicId: 'tpc_2FCHvjS7d4CA' });
  });

  it('resolves the source URL topic before returning from a document route to the bare chat', async () => {
    usePathnameMock.mockReturnValue(
      '/agent/agt_eH4zL98zBx5u/tpc_2FCHvjS7d4CA/page/docs_9B8hFkmEOZyPZb60',
    );

    render(<Nav />);

    fireEvent.click(screen.getByRole('button', { name: 'actions.addNewTopic' }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/agent/agt_eH4zL98zBx5u'));
    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(openNewTopicOrSaveTopicMock).toHaveBeenCalledWith({
      source: { agentId: 'agt_eH4zL98zBx5u', topicId: 'tpc_2FCHvjS7d4CA' },
      isCurrent: expect.any(Function),
    });
    expect(openNewTopicOrSaveTopicMock.mock.invocationCallOrder[0]).toBeLessThan(
      pushMock.mock.invocationCallOrder[0],
    );
  });

  it('pushes the agent chat route even when already on it', async () => {
    useParamsMock.mockReturnValue({ aid: 'agt_eH4zL98zBx5u' });
    usePathnameMock.mockReturnValue('/agent/agt_eH4zL98zBx5u');

    render(<Nav />);

    fireEvent.click(screen.getByRole('button', { name: 'actions.addNewTopic' }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/agent/agt_eH4zL98zBx5u'));
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it.each(['route', 'unmount'] as const)(
    'does not navigate after a pending load is invalidated by %s',
    async (kind) => {
      usePathnameMock.mockReturnValue('/agent/agt_eH4zL98zBx5u/tpc_2FCHvjS7d4CA');
      let finish!: (value: boolean) => void;
      openNewTopicOrSaveTopicMock.mockReturnValueOnce(
        new Promise((r) => {
          finish = r;
        }),
      );
      const view = render(
        <RouteContext value={0}>
          <Nav />
        </RouteContext>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'actions.addNewTopic' }));
      const options = openNewTopicOrSaveTopicMock.mock.calls[0][0];
      expect(options.isCurrent()).toBe(true);
      expect(pushMock).not.toHaveBeenCalled();
      if (kind === 'route') {
        usePathnameMock.mockReturnValue('/agent/agt_eH4zL98zBx5u/other-topic');
        useParamsMock.mockReturnValue({ aid: 'agt_eH4zL98zBx5u', topicId: 'other-topic' });
        view.rerender(
          <RouteContext value={1}>
            <Nav />
          </RouteContext>,
        );
      } else view.unmount();
      expect(options.isCurrent()).toBe(false);
      await act(async () => {
        finish(true);
      });
      expect(pushMock).not.toHaveBeenCalled();
    },
  );

  it('keeps the current route when a newer store operation cancelled creation', async () => {
    usePathnameMock.mockReturnValue('/agent/agt_eH4zL98zBx5u/tpc_2FCHvjS7d4CA');
    openNewTopicOrSaveTopicMock.mockResolvedValueOnce(false);
    render(<Nav />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'actions.addNewTopic' }));
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('disables starting a new topic for workspace viewers', () => {
    permissionMock.create_content = false;
    usePathnameMock.mockReturnValue('/agent/agt_eH4zL98zBx5u/channel');

    render(<Nav />);

    const startButton = screen.getByRole('button', { name: 'actions.addNewTopic' });
    expect(startButton).toBeDisabled();

    fireEvent.click(startButton);

    expect(pushMock).not.toHaveBeenCalled();
    expect(mutateMock).not.toHaveBeenCalled();
  });
});
