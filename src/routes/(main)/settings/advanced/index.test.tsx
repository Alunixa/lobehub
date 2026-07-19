import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { autoUpdateService } from '@/services/electron/autoUpdate';
import { initServerConfigStore, Provider } from '@/store/serverConfig/store';
import { useUserStore } from '@/store/user';

import Page from './index';

vi.hoisted(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: vi.fn(() => null),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    },
  });
});

vi.mock('@lobechat/const', async (importOriginal) => ({
  ...(await importOriginal()),
  isDesktop: true,
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    labItem: 'lab-item',
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@lobehub/ui', () => ({
  Form: ({
    items,
  }: {
    items: {
      children: { children?: ReactNode; desc?: string; label: string }[];
      extra?: ReactNode;
      title: string;
    }[];
  }) => (
    <div>
      {items.map((group) => (
        <section key={group.title}>
          <h2>{group.title}</h2>
          {group.children.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              {item.children}
            </div>
          ))}
          {group.extra}
        </section>
      ))}
    </div>
  ),
  Icon: () => null,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  InputPassword: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input type="password" {...props} />
  ),
  Skeleton: () => <div>loading</div>,
}));

vi.mock('@lobehub/ui/base-ui', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children?: ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
  Select: () => <button />,
  Switch: ({
    checked,
    onChange,
  }: {
    checked?: boolean;
    onChange?: (checked: boolean) => void;
  }) => (
    <button aria-pressed={checked} onClick={() => onChange?.(!checked)}>
      switch
    </button>
  ),
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/routes/(main)/settings/features/SettingHeader', () => ({
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('@/services/electron/autoUpdate', () => ({
  autoUpdateService: {
    getAutomaticUpdatesEnabled: vi.fn().mockResolvedValue(false),
    getUpdateChannel: vi.fn().mockResolvedValue('stable'),
    setAutomaticUpdatesEnabled: vi.fn(),
    setUpdateChannel: vi.fn(),
  },
}));

const createWrapper = () => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider createStore={() => initServerConfigStore({})}>{children}</Provider>
  );

  return Wrapper;
};

const initialUserStoreState = useUserStore.getState();

afterEach(() => {
  useUserStore.setState(initialUserStoreState, true);
});

describe('Advanced settings page', () => {
  it('uses distinct group titles for tools and app updates', () => {
    useUserStore.setState({
      isUserStateInit: true,
      setSettings: vi.fn(),
      updateLab: vi.fn(),
    });

    render(<Page />, { wrapper: createWrapper() });

    expect(screen.getByText('tab.advanced.toolsAndDiagnostics.title')).toBeDefined();
    expect(screen.getByText('tab.advanced.appUpdates.title')).toBeDefined();
  });

  it('renders the agent document floating chat panel lab toggle', () => {
    useUserStore.setState({
      isUserStateInit: true,
      setSettings: vi.fn(),
      updateLab: vi.fn(),
    });

    render(<Page />, { wrapper: createWrapper() });

    expect(screen.getByText('features.agentDocumentFloatingChatPanel.title')).toBeDefined();
  });

  it('renders automatic updates disabled by default and persists a toggle', async () => {
    useUserStore.setState({
      isUserStateInit: true,
      setSettings: vi.fn(),
      updateLab: vi.fn(),
    });

    render(<Page />, { wrapper: createWrapper() });

    expect(screen.getByText('tab.advanced.automaticUpdates.title')).toBeDefined();

    const automaticUpdateSwitch = screen
      .getByText('tab.advanced.automaticUpdates.title')
      .parentElement?.querySelector('button');
    expect(automaticUpdateSwitch).not.toBeNull();
    expect(automaticUpdateSwitch).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(automaticUpdateSwitch!);

    await waitFor(() => {
      expect(autoUpdateService.setAutomaticUpdatesEnabled).toHaveBeenCalledWith(true);
    });
  });

  it('reveals and saves account memory embedding settings', async () => {
    const setSettings = vi.fn().mockResolvedValue(undefined);
    useUserStore.setState({
      isUserStateInit: true,
      setSettings,
      updateLab: vi.fn(),
    });

    render(<Page />, { wrapper: createWrapper() });

    const embeddingSwitch = screen
      .getByText('tab.advanced.memoryEmbedding.enabled.title')
      .parentElement?.querySelector('button');
    fireEvent.click(embeddingSwitch!);

    const baseURLInput = screen
      .getByText('tab.advanced.memoryEmbedding.baseURL.title')
      .parentElement?.querySelector('input');
    const apiKeyInput = screen
      .getByText('tab.advanced.memoryEmbedding.apiKey.title')
      .parentElement?.querySelector('input');
    const modelInput = screen
      .getByText('tab.advanced.memoryEmbedding.model.title')
      .parentElement?.querySelector('input');

    fireEvent.change(baseURLInput!, { target: { value: 'https://embedding.example.com/v1' } });
    fireEvent.change(apiKeyInput!, { target: { value: 'secret-key' } });
    fireEvent.change(modelInput!, { target: { value: 'embedding-model' } });
    fireEvent.click(screen.getByText('tab.advanced.memoryEmbedding.save'));

    await waitFor(() => {
      expect(setSettings).toHaveBeenCalledWith({
        keyVaults: {
          memoryEmbedding: {
            apiKey: 'secret-key',
            baseURL: 'https://embedding.example.com/v1',
          },
        },
        memory: {
          embedding: {
            enabled: true,
            model: 'embedding-model',
          },
        },
      });
    });
  });
});
