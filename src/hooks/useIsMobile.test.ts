import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useIsMobile } from './useIsMobile';

const responsive = vi.hoisted(() => ({ mobile: false }));
vi.mock('antd-style', () => ({ useResponsive: () => responsive }));

beforeEach(() => {
  responsive.mobile = false;
});

describe('mobile surface selection', () => {
  it('keeps landscape phones mobile when compiled as the mobile app', () => {
    const { result } = renderHook(useIsMobile);
    expect(result.current).toBe(__MOBILE__);
  });

  it('still adapts a narrow desktop browser using responsive breakpoints', () => {
    responsive.mobile = true;
    const { result } = renderHook(useIsMobile);
    expect(result.current).toBe(true);
  });
});
