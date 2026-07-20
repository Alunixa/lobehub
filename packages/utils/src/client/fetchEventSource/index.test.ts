import { describe, expect, it, vi } from 'vitest';

import { CLOSE_EVENT_SOURCE, fetchEventSource } from './index';

describe('fetchEventSource', () => {
  it('should cancel an open response body when the message handler reports protocol completion', async () => {
    const encoder = new TextEncoder();
    let cancelReason: unknown;

    const body = new ReadableStream<Uint8Array>({
      cancel(reason) {
        cancelReason = reason;
      },
      start(controller) {
        controller.enqueue(encoder.encode('event: done\ndata: "completed"\n\n'));
      },
    });
    const fetcher = vi.fn(async () => {
      return new Response(body, {
        headers: { 'content-type': 'text/event-stream' },
        status: 200,
      });
    });
    const onclose = vi.fn();
    const onerror = vi.fn();

    await fetchEventSource('/stream', {
      fetch: fetcher,
      onclose,
      onerror,
      onmessage: (event) => {
        if (event.event === 'done') return CLOSE_EVENT_SOURCE;
      },
      onopen: async () => {},
    });

    expect(cancelReason).toBe(CLOSE_EVENT_SOURCE);
    expect(onclose).toHaveBeenCalledOnce();
    expect(onerror).not.toHaveBeenCalled();
  });
});
