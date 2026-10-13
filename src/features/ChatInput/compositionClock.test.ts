import { describe, expect, it } from 'vitest';

import { CompositionClock } from './compositionClock';

describe('composition clock', () => {
  it('starts on actual content changes, not focus', () => {
    const clock = new CompositionClock();
    expect(clock.snapshot(1000).composedForMs).toBe(0);
    clock.change(true, 2000);
    clock.change(true, 4000);
    expect(clock.snapshot(5500).composedForMs).toBe(3500);
  });
  it('resets empty input and starts a new message independently', () => {
    const clock = new CompositionClock();
    clock.change(true, 1000);
    clock.change(false, 5000);
    clock.change(true, 7000);
    expect(clock.snapshot(8000).composedForMs).toBe(1000);
    clock.reset();
    expect(clock.snapshot(10000).composedForMs).toBe(0);
  });
  it('restores a scoped draft start across remount/reload', () => {
    const first = new CompositionClock();
    first.change(true, 1000);
    const restored = new CompositionClock();
    restored.restore(first.start);
    expect(restored.snapshot(11000).composedForMs).toBe(10000);
  });
  it('handles clock reversal and validates the server duration limit', () => {
    const clock = new CompositionClock();
    clock.restore(2000);
    expect(clock.snapshot(1000).composedForMs).toBe(0);
    expect(clock.snapshot(30 * 24 * 3600 * 1000).composedForMs).toBe(7 * 24 * 3600 * 1000);
    clock.restore(Number.NaN);
    expect(clock.snapshot(10000).composedForMs).toBe(0);
  });
});
