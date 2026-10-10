import type { StreamChunkData } from '@lobechat/agent-gateway-client';
import { describe, expect, it, vi } from 'vitest';

import { createGatewayEventQueue } from './gatewayEventQueue';

describe('createGatewayEventQueue', () => {
  it('reconciles a replay burst once without losing any text or Unicode', async () => {
    const consume = vi.fn();
    const { enqueue, enqueueChunk } = createGatewayEventQueue(consume);
    const deltas = Array.from({ length: 10_000 }, (_, index) => `${index}中文🌧️\n`);
    for (const content of deltas) enqueueChunk({ chunkType: 'text', content });
    await new Promise<void>((resolve) => enqueue(resolve));

    expect(consume).toHaveBeenCalledOnce();
    expect(consume).toHaveBeenCalledWith({ chunkType: 'text', content: deltas.join('') });
  });

  it('renders the first text and thinking batches without a terminal or animation frame', async () => {
    const consume = vi.fn();
    const { enqueueChunk } = createGatewayEventQueue(consume);
    enqueueChunk({ chunkType: 'reasoning', reasoning: '思考中' });
    await Promise.resolve();
    expect(consume).toHaveBeenCalledWith({ chunkType: 'reasoning', reasoning: '思考中' });
    enqueueChunk({ chunkType: 'text', content: '正在输出' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(consume).toHaveBeenLastCalledWith({ chunkType: 'text', content: '正在输出' });
  });

  it('does not merge across reasoning, tool, snapshot, step or terminal boundaries', async () => {
    const order: unknown[] = [];
    const { enqueue, enqueueChunk } = createGatewayEventQueue((data) => order.push(data));
    enqueueChunk({ chunkType: 'reasoning', reasoning: 'think' });
    enqueueChunk({ chunkType: 'reasoning', reasoning: ' more' });
    enqueueChunk({ chunkType: 'text', content: 'first' });
    const toolChunk: StreamChunkData = { chunkType: 'tools_calling', toolsCalling: [] };
    enqueueChunk(toolChunk);
    enqueueChunk({ chunkType: 'text', content: ' after tool' });
    enqueue(() => {
      order.push('step snapshot');
    });
    enqueueChunk({ chunkType: 'text', content: 'second step' });
    await new Promise<void>((resolve) => {
      enqueue(() => {
        order.push('terminal');
        resolve();
      });
    });

    expect(order).toEqual([
      { chunkType: 'reasoning', reasoning: 'think more' },
      { chunkType: 'text', content: 'first' },
      toolChunk,
      { chunkType: 'text', content: ' after tool' },
      'step snapshot',
      { chunkType: 'text', content: 'second step' },
      'terminal',
    ]);
  });

  it('merges a queued burst behind a slow fetch but keeps each assistant step separate', async () => {
    const order: string[] = [];
    const { enqueue, enqueueChunk } = createGatewayEventQueue((data) => {
      order.push(data.content ?? '');
    });
    let unblock!: () => void;
    const blocked = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    enqueue(() => blocked);
    enqueueChunk({ chunkType: 'text', content: 'old' });
    enqueueChunk({ chunkType: 'text', content: ' step' });
    enqueue(() => {
      order.push('switch assistant');
    });
    enqueueChunk({ chunkType: 'text', content: 'new' });
    enqueueChunk({ chunkType: 'text', content: ' step' });
    const complete = new Promise<void>((resolve) => enqueue(resolve));
    await Promise.resolve();
    expect(order).toEqual([]);
    unblock();
    await complete;
    expect(order).toEqual(['old step', 'switch assistant', 'new step']);
  });
});
