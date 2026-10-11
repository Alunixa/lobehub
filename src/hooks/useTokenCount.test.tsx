import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as tokenizer from '@/utils/tokenizer';

import { useTokenCount } from './useTokenCount';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('token estimation request lifecycle', () => {
  it('discards an old worker result after switching conversation text', async () => {
    const old = Promise.withResolvers<number>();
    const next = Promise.withResolvers<number>();
    vi.spyOn(tokenizer, 'encodeAsync')
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(next.promise);
    const { result, rerender } = renderHook(({ text }) => useTokenCount(text), {
      initialProps: { text: 'old context' },
    });
    await act(() => vi.advanceTimersByTimeAsync(300));
    rerender({ text: 'new context' });
    await act(() => vi.advanceTimersByTimeAsync(300));
    await act(async () => {
      next.resolve(42);
      await next.promise;
    });
    expect(result.current).toBe(42);
    await act(async () => {
      old.resolve(500_000);
      await old.promise;
    });
    expect(result.current).toBe(42);
  });

  it('does not expose the previous conversation count while the next estimate is pending', async () => {
    vi.spyOn(tokenizer, 'encodeAsync').mockResolvedValueOnce(4000);
    const { result, rerender } = renderHook(({ text }) => useTokenCount(text), {
      initialProps: { text: 'previous context' },
    });
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(result.current).toBe(4000);
    rerender({ text: 'different topic' });
    expect(result.current).toBe(0);
  });

  it('cancels a queued count when unmounted', async () => {
    const encode = vi.spyOn(tokenizer, 'encodeAsync');
    const { unmount } = renderHook(() => useTokenCount('pending'));
    unmount();
    await vi.advanceTimersByTimeAsync(300);
    expect(encode).not.toHaveBeenCalled();
  });
});
