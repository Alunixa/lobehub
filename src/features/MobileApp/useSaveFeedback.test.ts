import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useSaveFeedback } from './useSaveFeedback';

afterEach(() => vi.restoreAllMocks());

describe('mobile setting save feedback', () => {
  it('serializes edits so older requests cannot overwrite later edits', async () => {
    const { result } = renderHook(useSaveFeedback);
    const first = Promise.withResolvers<void>();
    const order: string[] = [];
    let saving: Promise<void>;
    act(() => {
      saving = result.current.save(async () => {
        await first.promise;
        order.push('first');
      });
    });
    act(() => {
      void result.current.save(async () => {
        order.push('second');
      });
    });
    expect(result.current.status).toBe('saving');
    expect(order).toEqual([]);
    await act(async () => {
      first.resolve();
      await saving;
    });
    expect(order).toEqual(['first', 'second']);
    expect(result.current.status).toBe('saved');
  });

  it('retains failed and queued edits until explicit retry succeeds', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(useSaveFeedback);
    const first = vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error('offline'));
    first.mockResolvedValue(undefined);
    const second = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    await act(async () => result.current.save(first));
    expect(result.current.status).toBe('error');
    await act(async () => result.current.save(second));
    expect(second).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    await act(async () => result.current.retry());
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('saved');
  });
});
