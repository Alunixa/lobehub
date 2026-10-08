import { describe, expect, it, vi } from 'vitest';

import { createResumableAgentStream } from '@/server/modules/AgentRuntime/resumableStream';
import type { IStreamEventManager } from '@/server/modules/AgentRuntime/types';

const manager = (events: Awaited<ReturnType<IStreamEventManager['readEventsOnce']>>['events']) => ({
  readEventsOnce: vi.fn(async (_id: string, cursor = '0') => {
    const index = events.findIndex((event) => event.id === cursor);
    const next = events.slice(index + 1);
    return { events: next, lastEventId: next.at(-1)?.id ?? cursor };
  }),
});

describe('server-owned stream subscriptions', () => {
  it('replays events exactly once after the concrete cursor and closes on terminal', async () => {
    const events = [
      {
        data: { content: 'old' },
        id: '10-0',
        operationId: 'op',
        stepIndex: 0,
        timestamp: 10,
        type: 'stream_chunk' as const,
      },
      {
        data: { content: 'new' },
        id: '11-0',
        operationId: 'op',
        stepIndex: 0,
        timestamp: 11,
        type: 'stream_chunk' as const,
      },
      {
        data: { reason: 'done' },
        id: '12-0',
        operationId: 'op',
        stepIndex: 0,
        timestamp: 12,
        type: 'agent_runtime_end' as const,
      },
    ];
    const stream = createResumableAgentStream({
      getStatus: async () => 'running',
      lastEventId: '10-0',
      manager: manager(events),
      operationId: 'op',
    });
    const text = await new Response(stream).text();
    expect(text).not.toContain('"content":"old"');
    expect(text.match(/"content":"new"/g)).toHaveLength(1);
    expect(text).toContain('id: 11-0');
    expect(text).toContain('agent_runtime_end');
  });

  it('two viewers are independent; cancelling one does not terminate the producer or the other', async () => {
    const events: Parameters<typeof manager>[0] = [];
    const shared = manager(events);
    const abort = new AbortController();
    const params = {
      getStatus: async () => 'running',
      lastEventId: '0',
      manager: shared,
      operationId: 'op',
    };
    const first = createResumableAgentStream({ ...params, signal: abort.signal });
    const second = createResumableAgentStream(params);
    const firstReader = first.getReader();
    await firstReader.read();
    abort.abort();
    events.push(
      {
        data: { content: 'survives' },
        id: '20-0',
        operationId: 'op',
        stepIndex: 0,
        timestamp: 20,
        type: 'stream_chunk',
      },
      {
        data: { reason: 'done' },
        id: '21-0',
        operationId: 'op',
        stepIndex: 0,
        timestamp: 21,
        type: 'agent_runtime_end',
      },
    );
    const answer = await new Response(second).text();
    expect(answer).toContain('survives');
    expect(answer).toContain('agent_runtime_end');
    expect((await firstReader.read()).done).toBe(true);
    firstReader.releaseLock();
  });

  it('uses persisted terminal status after event retention expires instead of hanging', async () => {
    const stream = createResumableAgentStream({
      getStatus: async () => 'done',
      lastEventId: '0',
      manager: manager([]),
      operationId: 'op',
    });
    const text = await new Response(stream).text();
    expect(text).toContain('"reason":"done"');
  });
});
