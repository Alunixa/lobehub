import { act, renderHook } from '@testing-library/react';
import { estimateTokenCount } from 'tokenx';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as tokenizers from '@/utils/tokenizer';

import { useTokenCount } from './useTokenCount';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useTokenCount', () => {
  it('shows an immediate estimate before the worker returns its count', async () => {
    vi.spyOn(tokenizers, 'encodeAsync').mockResolvedValueOnce(7);
    const { result } = renderHook(() => useTokenCount('test input'));

    expect(result.current).toBe(estimateTokenCount('test input'));
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(result.current).toBe(7);
  });

  it('retains the semantic estimate if the worker fails instead of displaying zero', async () => {
    vi.spyOn(tokenizers, 'encodeAsync').mockRejectedValueOnce(new Error('encode error'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useTokenCount('test input'));

    expect(result.current).toBe(estimateTokenCount('test input'));
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(result.current).toBe(estimateTokenCount('test input'));
    expect(log).toHaveBeenCalledWith('Token estimation worker failed:', expect.any(Error));
  });

  it('should handle empty input', async () => {
    vi.spyOn(tokenizers, 'encodeAsync').mockResolvedValueOnce(0);
    const { result } = renderHook(() => useTokenCount(''));

    expect(result.current).toBe(0);
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(result.current).toBe(0);
  });
  it('should handle null input', async () => {
    vi.spyOn(tokenizers, 'encodeAsync').mockResolvedValueOnce(0);
    const { result } = renderHook(() => useTokenCount(null as unknown as string));

    expect(result.current).toBe(0);
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(result.current).toBe(0);
  });
});
