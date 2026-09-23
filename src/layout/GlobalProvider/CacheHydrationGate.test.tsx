import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Import after mocks are registered.
import CacheHydrationGate from './CacheHydrationGate';

// --- controllable inputs -----------------------------------------------------
let mockIsAuthLoaded = true;
let mockIsUserStateInit = true;
let mockIsDesktop = false;

vi.mock('@/store/user', () => ({
  useUserStore: (selector: (s: any) => unknown) =>
    selector({ isLoaded: mockIsAuthLoaded, isUserStateInit: mockIsUserStateInit }),
}));

vi.mock('@/store/user/selectors', () => ({
  authSelectors: { isLoaded: (s: any) => s.isLoaded },
}));

vi.mock('@/libs/bootTiming', () => ({
  bootTiming: { mark: vi.fn() },
}));

vi.mock('@lobechat/const', () => ({
  get isDesktop() {
    return mockIsDesktop;
  },
}));

const Child = () => <div data-testid="app">app content</div>;

const renderGate = () =>
  render(
    <CacheHydrationGate>
      <Child />
    </CacheHydrationGate>,
  );

beforeEach(() => {
  mockIsAuthLoaded = true;
  mockIsUserStateInit = true;
  mockIsDesktop = false;
  // A loading-screen node so the gate's removal side-effect has a target.
  const el = document.createElement('div');
  el.id = 'loading-screen';
  document.body.appendChild(el);
});

afterEach(() => {
  document.getElementById('loading-screen')?.remove();
  vi.useRealTimers();
});

describe('CacheHydrationGate', () => {
  it('releases first paint once the web identity is loaded without waiting for IndexedDB', () => {
    renderGate();

    expect(screen.queryByTestId('app')).not.toBeNull();
    expect(document.getElementById('loading-screen')).toBeNull();
  });

  it('does not introduce a hydration gate after the app has mounted', () => {
    renderGate();

    expect(screen.queryByTestId('app')).not.toBeNull();
  });

  it('desktop first paint waits for isUserStateInit', () => {
    mockIsDesktop = true;
    mockIsUserStateInit = false;
    const rendered = renderGate();

    expect(screen.queryByTestId('app')).toBeNull();

    mockIsUserStateInit = true;
    act(() => {
      rendered.rerender(
        <CacheHydrationGate>
          <Child />
        </CacheHydrationGate>,
      );
    });
    expect(screen.queryByTestId('app')).not.toBeNull();
  });

  it('timeout backstop releases the app even if identity never becomes ready', () => {
    vi.useFakeTimers();
    mockIsDesktop = true;
    mockIsAuthLoaded = false;
    mockIsUserStateInit = false;
    renderGate();
    expect(screen.queryByTestId('app')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.queryByTestId('app')).not.toBeNull();
  });
});
