import { describe, expect, it } from 'vitest';

import { shouldHandleActionIconClick } from './actionUtils';

describe('shouldHandleActionIconClick', () => {
  it('lets the overlay trigger own clicks when an overlay is present', () => {
    expect(shouldHandleActionIconClick(true)).toBe(false);
  });

  it('keeps direct actions clickable without an overlay', () => {
    expect(shouldHandleActionIconClick(false)).toBe(true);
  });
});
