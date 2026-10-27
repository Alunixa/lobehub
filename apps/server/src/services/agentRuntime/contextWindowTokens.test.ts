import { describe, expect, it } from 'vitest';

import { resolveContextWindowTokens } from './contextWindowTokens';

describe('resolveContextWindowTokens', () => {
  it('prefers the user-configured model window over the model-bank default', () => {
    expect(resolveContextWindowTokens(32_000, 128_000)).toBe(32_000);
  });

  it('falls back to the model-bank window when no valid override exists', () => {
    expect(resolveContextWindowTokens(null, 128_000)).toBe(128_000);
    expect(resolveContextWindowTokens(0, 128_000)).toBe(128_000);
    expect(resolveContextWindowTokens(Number.POSITIVE_INFINITY, 128_000)).toBe(128_000);
  });

  it('returns undefined when every candidate is invalid', () => {
    expect(resolveContextWindowTokens(undefined, 1.5, -1)).toBeUndefined();
  });
});
