import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useMobileViewport } from './useMobileViewport';

afterEach(() => vi.unstubAllGlobals());

describe('mobile viewport', () => {
  it('tracks keyboard resize, ignores pinch zoom, and removes listeners', () => {
    const viewport = Object.assign(new EventTarget(), { height: 780, scale: 1 });
    vi.stubGlobal('visualViewport', viewport);
    const { result, unmount } = renderHook(useMobileViewport);
    const element = document.createElement('div');
    result.current.current = element;
    act(() => viewport.dispatchEvent(new Event('resize')));
    expect(element.style.getPropertyValue('--mobile-viewport-height')).toBe('780px');
    act(() => {
      viewport.height = 360;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(element.style.getPropertyValue('--mobile-viewport-height')).toBe('360px');
    act(() => {
      viewport.scale = 2;
      viewport.height = 180;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(element.style.getPropertyValue('--mobile-viewport-height')).toBe('360px');
    unmount();
    viewport.scale = 1;
    viewport.height = 900;
    viewport.dispatchEvent(new Event('resize'));
    expect(element.style.getPropertyValue('--mobile-viewport-height')).toBe('360px');
  });

  it('falls back to innerHeight when VisualViewport is unavailable', () => {
    vi.stubGlobal('visualViewport', undefined);
    vi.stubGlobal('innerHeight', 640);
    const { result } = renderHook(useMobileViewport);
    const element = document.createElement('div');
    result.current.current = element;
    act(() => window.dispatchEvent(new Event('resize')));
    expect(element.style.getPropertyValue('--mobile-viewport-height')).toBe('640px');
  });
});
