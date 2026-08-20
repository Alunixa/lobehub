import { describe, expect, it } from 'vitest';

import { isCustomDimensionValid, parseSizeValue } from './utils';

describe('parseSizeValue', () => {
  it('should parse valid custom image dimensions', () => {
    expect(parseSizeValue('2048x1024')).toEqual({ height: 1024, width: 2048 });
    expect(parseSizeValue('3840X2160')).toEqual({ height: 2160, width: 3840 });
  });

  it('should reject auto, ratios, decimals, and non-positive dimensions', () => {
    expect(parseSizeValue('auto')).toBeNull();
    expect(parseSizeValue('2:1')).toBeNull();
    expect(parseSizeValue('1024.5x512')).toBeNull();
    expect(parseSizeValue('0x512')).toBeNull();
  });
});

describe('isCustomDimensionValid', () => {
  it('should enforce positive custom dimension bounds', () => {
    expect(isCustomDimensionValid(2048, 256, 4096)).toBe(true);
    expect(isCustomDimensionValid(128, 256, 4096)).toBe(false);
    expect(isCustomDimensionValid(8192, 256, 4096)).toBe(false);
    expect(isCustomDimensionValid(null, 256, 4096)).toBe(false);
  });
});
