// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

import { describe, expect, it, vi } from 'vitest';

const source = await readFile(
  new URL('../../../../../public/proactive-push-sw.js', import.meta.url),
  'utf8',
);
const fixture = (clients: Array<Record<string, unknown>> = []) => {
  const events: Record<string, (event: unknown) => void> = {};
  const notification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  runInNewContext(source, {
    URL,
    self: {
      location: { origin: 'https://fixture.invalid' },
      skipWaiting: vi.fn(),
      clients: { matchAll: vi.fn().mockResolvedValue(clients), openWindow },
      registration: { showNotification: notification },
      addEventListener: (type: string, handler: (event: unknown) => void) => {
        events[type] = handler;
      },
    },
  });
  const push = async (url = '/agent/a/topic') => {
    let pending: Promise<unknown> = Promise.resolve();
    events.push({
      data: { json: () => ({ title: 'AI', body: 'Visible reply', id: 'notice-1', url }) },
      waitUntil: (work: Promise<unknown>) => {
        pending = work;
      },
    });
    await pending;
  };
  return { events, notification, openWindow, push };
};

describe('isolated proactive Web Push worker', () => {
  it('creates a tagged system notification when the page is closed', async () => {
    const worker = fixture();
    await worker.push();
    expect(worker.notification).toHaveBeenCalledWith(
      'AI',
      expect.objectContaining({
        body: 'Visible reply',
        tag: 'proactive:notice-1',
        data: { url: 'https://fixture.invalid/agent/a/topic' },
      }),
    );
  });
  it('routes a foreground message to the app rather than duplicating a system banner', async () => {
    const postMessage = vi.fn();
    const worker = fixture([{ visibilityState: 'visible', postMessage }]);
    await worker.push();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'proactive-notification' }),
    );
    expect(worker.notification).not.toHaveBeenCalled();
  });
  it.each(['https://other.invalid/agent/a/topic', 'javascript:alert(1)', '/settings'])(
    'refuses a cross-origin or non-conversation action URL: %s',
    async (url) => {
      const worker = fixture();
      await worker.push(url);
      expect(worker.notification).not.toHaveBeenCalled();
    },
  );
  it('opens only the validated conversation when the user explicitly clicks', async () => {
    const worker = fixture();
    let pending: Promise<unknown> = Promise.resolve();
    worker.events.notificationclick({
      notification: { close: vi.fn(), data: { url: 'https://fixture.invalid/agent/a/topic' } },
      waitUntil: (work: Promise<unknown>) => {
        pending = work;
      },
    });
    await pending;
    expect(worker.openWindow).toHaveBeenCalledWith('https://fixture.invalid/agent/a/topic');
  });
});
