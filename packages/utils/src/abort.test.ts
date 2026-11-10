import { describe, expect, it } from 'vitest';

import { raceWithAbort } from './abort';

describe('raceWithAbort', () => {
  it('returns the operation result when it completes first', async () => {
    await expect(
      raceWithAbort(Promise.resolve('done'), new AbortController().signal),
    ).resolves.toBe('done');
  });

  it('rejects promptly when cancellation happens before the operation settles', async () => {
    const controller = new AbortController();
    const operation = new Promise<string>(() => {});
    const result = raceWithAbort(operation, controller.signal);
    controller.abort(new DOMException('Stopped', 'AbortError'));

    await expect(result).rejects.toMatchObject({ name: 'AbortError', message: 'Stopped' });
  });

  it('does not leave a late operation rejection unhandled after cancellation', async () => {
    const controller = new AbortController();
    let rejectOperation: (reason: Error) => void = () => {};
    const operation = new Promise<string>((_, reject) => {
      rejectOperation = reject;
    });
    const result = raceWithAbort(operation, controller.signal);
    controller.abort();

    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    rejectOperation(new Error('late failure'));
    await Promise.resolve();
  });
});
