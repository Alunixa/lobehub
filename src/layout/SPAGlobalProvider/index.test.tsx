/**
 * @vitest-environment happy-dom
 */
import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { APP_THEME_ROOT_CLASS_NAME } from '@/const/theme';
import type * as AppThemeModule from '@/layout/GlobalProvider/AppTheme';

import type SPAGlobalProviderComponent from './index';

let SPAGlobalProvider: typeof SPAGlobalProviderComponent;

vi.mock('@lobehub/ui', async () => {
  const React = await import('react');
  const Passthrough = ({ children }: { children?: ReactNode }) =>
    React.createElement(React.Fragment, null, children);

  return {
    ContextMenuHost: () => React.createElement('div', { 'data-testid': 'context-menu-host' }),
    ModalHost: () => React.createElement('div', { 'data-testid': 'legacy-modal-host' }),
    ConfigProvider: Passthrough,
    FontLoader: () => null,
    ThemeProvider: ({ children, className }: { children?: ReactNode; className?: string }) =>
      React.createElement('div', { className, 'data-testid': 'app-theme-root' }, children),
    TooltipGroup: Passthrough,
  };
});

vi.mock('@lobehub/ui/base-ui', async () => {
  const React = await import('react');

  return {
    ModalHost: () => React.createElement('div', { 'data-testid': 'base-modal-host' }),
    ToastHost: () => React.createElement('div', { 'data-testid': 'toast-host' }),
  };
});

vi.mock('antd-style', async () => {
  const React = await import('react');

  return {
    createStaticStyles: () => ({
      app: 'fixture-app-layout',
      scrollbar: 'fixture-scrollbar',
      scrollbarPolyfill: 'fixture-scrollbar-polyfill',
    }),
    cx: (...values: (string | undefined)[]) => values.filter(Boolean).join(' '),
    useTheme: () => ({ fontFamily: 'system-ui' }),
    StyleProvider: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

vi.mock('motion/react', async () => {
  const React = await import('react');

  return {
    LazyMotion: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    domMax: {},
  };
});

vi.mock('@/components/Analytics/LobeAnalyticsProviderWrapper', async () => {
  const React = await import('react');

  return {
    LobeAnalyticsProviderWrapper: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

vi.mock('@/components/DragUploadZone/DragUploadProvider', async () => {
  const React = await import('react');

  return {
    DragUploadProvider: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

vi.mock('@/const/version', () => ({
  isDesktop: false,
}));

vi.mock('@/features/AgentMockDevtools', () => ({
  default: () => null,
}));

vi.mock('@/features/DevFeatureFlagPanel', () => ({
  default: () => null,
}));

vi.mock('@/features/GlobalBackground', async () => {
  const React = await import('react');
  return {
    GlobalBackground: () => React.createElement('div', { 'data-testid': 'global-background' }),
  };
});

vi.mock('@/features/Conversation/ProactiveNotificationObserver', () => ({ default: () => null }));

vi.mock('@/hooks/useIsDark', () => ({ useIsDark: () => false }));
vi.mock('@/store/user', () => ({
  useUserStore: (selector: (state: unknown) => unknown) => selector({}),
}));
vi.mock('@/store/user/selectors', () => ({
  userGeneralSettingsSelectors: {
    animationMode: () => 'agile',
    neutralColor: () => undefined,
    primaryColor: () => undefined,
  },
}));
vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: (state: unknown) => unknown) => selector({}),
}));
vi.mock('@/store/global/selectors', () => ({
  systemStatusSelectors: { language: () => 'en-US' },
}));
vi.mock('@/libs/getUILocaleAndResources', () => ({
  getUILocaleAndResources: async () => ({ locale: 'en-US', resources: undefined }),
}));
vi.mock('@/styles', () => ({ GlobalStyle: () => null }));

vi.mock('@/layout/AuthProvider', async () => {
  const React = await import('react');

  return {
    default: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

vi.mock('@/layout/AuthProvider/MarketAuth', async () => {
  const React = await import('react');

  return {
    MarketAuthProvider: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', { 'data-testid': 'market-auth-provider' }, children),
  };
});

vi.mock('@/layout/GlobalProvider/AppTheme', async () => {
  const React = await import('react');

  return {
    default: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

vi.mock('@/layout/GlobalProvider/CacheHydrationGate', async () => {
  const React = await import('react');

  return {
    default: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

vi.mock('@/layout/GlobalProvider/DynamicFavicon', () => ({
  default: () => null,
}));

vi.mock('@/layout/GlobalProvider/FaviconProvider', async () => {
  const React = await import('react');

  return {
    FaviconProvider: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

vi.mock('@/layout/GlobalProvider/GroupWizardProvider', async () => {
  const React = await import('react');

  return {
    GroupWizardProvider: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

vi.mock('@/layout/GlobalProvider/Query', async () => {
  const React = await import('react');

  return {
    default: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

vi.mock('@/layout/GlobalProvider/ServerVersionOutdatedAlert', () => ({
  default: () => null,
}));

vi.mock('@/layout/GlobalProvider/StoreInitialization', () => ({
  default: () => null,
}));

vi.mock('@/store/serverConfig/Provider', async () => {
  const React = await import('react');

  return {
    ServerConfigStoreProvider: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

vi.mock('./Locale', async () => {
  const React = await import('react');

  return {
    default: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

describe('SPAGlobalProvider', () => {
  beforeAll(async () => {
    SPAGlobalProvider = (await import('./index')).default;
  });

  beforeEach(() => {
    vi.stubGlobal('__DEV__', false);
    Reflect.deleteProperty(window, '__SERVER_CONFIG__');
  });

  it('provides Market auth from the SPA global provider', async () => {
    await act(async () => {
      render(
        <SPAGlobalProvider>
          <div data-testid="spa-route-content" />
        </SPAGlobalProvider>,
      );
    });

    const routeContent = screen.getByTestId('spa-route-content');

    expect(routeContent.closest('[data-testid="market-auth-provider"]')).not.toBeNull();
  });

  it('mounts the background in the same signed-in provider tree as routes', async () => {
    await act(async () => {
      render(
        <SPAGlobalProvider>
          <div />
        </SPAGlobalProvider>,
      );
    });
    expect(
      screen.getByTestId('global-background').closest('[data-testid="market-auth-provider"]'),
    ).not.toBeNull();
  });

  it('the actual AppTheme passes the shared background surface class to its App element', async () => {
    const { default: AppTheme } = await vi.importActual<typeof AppThemeModule>(
      '@/layout/GlobalProvider/AppTheme',
    );
    await act(async () => {
      render(
        <AppTheme>
          <span>Real theme root contract</span>
        </AppTheme>,
      );
    });
    expect(screen.getByTestId('app-theme-root')).toHaveClass(APP_THEME_ROOT_CLASS_NAME);
    // The vendor's lobe-ui-theme-app is an id on a display-contents descendant.
    expect(screen.getByTestId('app-theme-root')).not.toHaveClass('lobe-ui-theme-app');
  });
});
