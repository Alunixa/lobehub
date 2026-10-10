import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RuntimeExecutorContext } from '@/server/modules/AgentRuntime/context';
import { watchOperationInterruption } from '@/server/modules/AgentRuntime/operationInterruption';

afterEach(() => vi.useRealTimers());

describe('producer cancellation is independent of subscribers', () => {
  it('observes status without repeatedly cloning a large conversation', async () => {
    vi.useFakeTimers();
    const getOperationStatus = vi.fn(async () => 'interrupted');
    const loadAgentState = vi.fn();
    const watcher = watchOperationInterruption({
      operationId: 'op',
      getOperationStatus,
      loadAgentState,
    } as unknown as RuntimeExecutorContext);
    try {
      await vi.advanceTimersByTimeAsync(1000);
      expect(watcher.signal.aborted).toBe(true);
      expect(loadAgentState).not.toHaveBeenCalled();
    } finally {
      watcher.dispose();
    }
  });

  it('aborts the upstream after explicit operation interruption, not on viewer disconnect', async () => {
    vi.useFakeTimers();
    let status = 'running';
    const loadAgentState = vi.fn(async () => ({ status }));
    const watcher = watchOperationInterruption({
      operationId: 'op',
      loadAgentState,
    } as unknown as RuntimeExecutorContext);
    try {
      await vi.advanceTimersByTimeAsync(1000);
      expect(watcher.signal.aborted).toBe(false);
      status = 'interrupted';
      await vi.advanceTimersByTimeAsync(1000);
      expect(watcher.signal.aborted).toBe(true);
      expect(watcher.signal.reason.name).toBe('AbortError');
    } finally {
      watcher.dispose();
    }
  });

  it('cleans up the cancellation observer without aborting a completed request', async () => {
    vi.useFakeTimers();
    const loadAgentState = vi.fn(async () => ({ status: 'running' }));
    const watcher = watchOperationInterruption({
      operationId: 'op',
      loadAgentState,
    } as unknown as RuntimeExecutorContext);
    watcher.dispose();
    await vi.advanceTimersByTimeAsync(5000);
    expect(loadAgentState).not.toHaveBeenCalled();
    expect(watcher.signal.aborted).toBe(false);
  });
});
