import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCooperativeQueue } from './cooperativeQueue';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createCooperativeQueue', () => {
  it('lets an input task run before a replay backlog has finished', async () => {
    const enqueue = createCooperativeQueue();
    const seen: number[] = [];
    const inputTurn = new Promise<number>((resolve) => {
      setTimeout(() => resolve(seen.length), 0);
    });
    const complete = new Promise<void>((resolve) => {
      for (let index = 0; index < 100; index += 1) {
        enqueue(() => {
          seen.push(index);
          if (index === 99) resolve();
        });
      }
    });

    const countWhenInputRan = await inputTurn;
    expect(countWhenInputRan).toBeGreaterThan(0);
    expect(countWhenInputRan).toBeLessThan(100);
    await complete;
    expect(seen).toEqual(Array.from({ length: 100 }, (_, index) => index));
  });

  it('yields on the time budget even when fewer than 32 tasks have run', async () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const enqueue = createCooperativeQueue();
    let completed = 0;
    const inputTurn = new Promise<number>((resolve) => {
      setTimeout(() => resolve(completed), 0);
    });
    const complete = new Promise<void>((resolve) => {
      for (let index = 0; index < 4; index += 1) {
        enqueue(() => {
          completed += 1;
          now += 9;
          if (completed === 4) resolve();
        });
      }
    });

    expect(await inputTurn).toBe(1);
    await complete;
    expect(completed).toBe(4);
  });

  it('waits for asynchronous reconciliation without reordering later chunks', async () => {
    const enqueue = createCooperativeQueue();
    const order: string[] = [];
    let unblock!: () => void;
    const blocked = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    enqueue(async () => {
      order.push('fetch');
      await blocked;
      order.push('snapshot');
    });
    const complete = new Promise<void>((resolve) => {
      enqueue(() => {
        order.push('chunk');
        resolve();
      });
    });

    await Promise.resolve();
    expect(order).toEqual(['fetch']);
    unblock();
    await complete;
    expect(order).toEqual(['fetch', 'snapshot', 'chunk']);
  });

  it('reports a failed task and continues processing and accepts a later batch', async () => {
    const error = new Error('reconciliation failed');
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    const enqueue = createCooperativeQueue();
    enqueue(() => {
      throw error;
    });
    await new Promise<void>((resolve) => enqueue(resolve));
    expect(report).toHaveBeenCalledWith(error);
    await new Promise<void>((resolve) => enqueue(resolve));
  });
});
