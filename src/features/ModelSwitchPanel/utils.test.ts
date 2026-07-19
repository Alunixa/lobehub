import { describe, expect, it } from 'vitest';

import { resolveOpenOnHover } from './utils';

describe('resolveOpenOnHover', () => {
  it('should disable hover triggering on mobile devices', () => {
    expect(resolveOpenOnHover(true, true)).toBe(false);
  });

  it('should preserve the configured hover behavior on desktop', () => {
    expect(resolveOpenOnHover(true, false)).toBe(true);
    expect(resolveOpenOnHover(false, false)).toBe(false);
  });
});
