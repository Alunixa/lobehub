import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getBytes,
  getLines,
  getMessages,
} from '../../packages/utils/src/client/fetchEventSource/parse';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buffered SSE replay', () => {
  it('yields to input without corrupting split UTF-8, cursors or event ordering', async () => {
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      clock += 2;
      return clock;
    });
    const expected = Array.from({ length: 80 }, (_, index) => ({
      data: `中文🌧️-${index}`,
      event: 'chunk',
      id: `${index + 1}-0`,
    }));
    const bytes = new TextEncoder().encode(
      expected
        .map(({ data, event, id }) => `id: ${id}\nevent: ${event}\ndata: ${data}\n\n`)
        .join(''),
    );
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Deliberately split characters and SSE fields at byte boundaries.
        for (let index = 0; index < bytes.length; index += 17) {
          controller.enqueue(bytes.subarray(index, index + 17));
        }
        controller.close();
      },
    });
    const received: typeof expected = [];
    const inputTurn = new Promise<number>((resolve) => {
      setTimeout(() => resolve(received.length), 0);
    });
    const replay = getBytes(
      stream,
      getLines(
        getMessages(
          () => {},
          (event) => received.push(event),
        ),
      ),
    );

    const receivedWhenInputRan = await inputTurn;
    expect(receivedWhenInputRan).toBeGreaterThan(0);
    expect(receivedWhenInputRan).toBeLessThan(expected.length);
    await replay;
    expect(received).toEqual(expected);
    expect(stream.locked).toBe(false);
  });
});
