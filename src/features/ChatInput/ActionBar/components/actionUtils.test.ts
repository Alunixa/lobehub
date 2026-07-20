import { describe, expect, it } from 'vitest';

import { shouldUseExplicitMobileOverlayClick } from './actionUtils';

describe('shouldUseExplicitMobileOverlayClick', () => {
  it('handles overlay clicks explicitly on mobile', () => {
    expect(shouldUseExplicitMobileOverlayClick(true, true)).toBe(true);
  });

  it('lets the overlay trigger own clicks on desktop', () => {
    expect(shouldUseExplicitMobileOverlayClick(true, false)).toBe(false);
  });

  it('does not intercept actions without an overlay', () => {
    expect(shouldUseExplicitMobileOverlayClick(false, true)).toBe(false);
  });
});
