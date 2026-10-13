// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { resolveProactiveDueAt } from './plan';

describe('AI-selected one-shot deadlines', () => {
  const now = new Date('2026-10-13T10:00:00Z');
  it('uses the arbitrary idle duration chosen by AI, not a fixed cadence', () => {
    expect(resolveProactiveDueAt({ idleForSeconds: 731 }, now)).toBe('2026-10-13T10:12:11.000Z');
    expect(resolveProactiveDueAt({ idleForSeconds: 4003 }, now)).toBe('2026-10-13T11:06:43.000Z');
  });
  it('normalizes explicit timezones to a durable UTC deadline', () => {
    expect(resolveProactiveDueAt({ sendAt: '2026-10-13T20:17:00+08:00' }, now)).toBe(
      '2026-10-13T12:17:00.000Z',
    );
  });
  it('does not generate a replacement default for invalid/past deadlines', () => {
    expect(resolveProactiveDueAt({ sendAt: 'invalid' }, now)).toBeUndefined();
    expect(resolveProactiveDueAt({ sendAt: '2026-10-13T09:00:00Z' }, now)).toBeUndefined();
    expect(resolveProactiveDueAt({ sendAt: '2030-01-01T00:00:00Z' }, now)).toBeUndefined();
  });
});
