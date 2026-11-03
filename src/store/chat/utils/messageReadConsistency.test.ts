import type { UIChatMessage } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import { mergeMessageRead, readMessagesWithBoundary } from './messageReadConsistency';

const row = (id: string, content = id, updatedAt = 1) =>
  ({
    id,
    content,
    createdAt: Number(id.replace(/\D/g, '')) || 1,
    updatedAt,
    role: 'assistant',
  }) as UIChatMessage;
const read = (before: UIChatMessage[], fetched: UIChatMessage[], ids: string[] = []) =>
  readMessagesWithBoundary(
    { key: 'topic-a', messages: before, protectedIds: new Set(ids) },
    async () => fetched,
  );
const options = { key: 'topic-a' };

describe('message snapshot consistency (upstream #20891/#21083)', () => {
  it('keeps a user message created after an old request started, even after send ended', async () => {
    const old = row('1');
    const result = await read([old], [old]);
    const user = { ...row('2'), role: 'user' as const };
    expect(mergeMessageRead(result, [old, user], options)).toEqual([old, user]);
  });

  it('keeps optimistic rows that existed before a read while their write was pending', async () => {
    const local = [row('1'), row('2')];
    const result = await read(local, [], ['1', '2']);
    expect(mergeMessageRead(result, local, options)).toEqual(local);
  });

  it('does not roll back streamed text with an equal database timestamp', async () => {
    const start = row('1', 'start');
    const result = await read([start], [start]);
    const final = row('1', 'complete answer');
    expect(mergeMessageRead(result, [final], options)[0].content).toBe('complete answer');
  });

  it('protects a read issued during streaming even when no later local chunk arrived', async () => {
    const final = row('1', 'complete answer');
    const result = await read([final], [row('1', '...')], ['1']);
    expect(mergeMessageRead(result, [final], options)).toEqual([final]);
  });

  it('keeps a persisted server id after its temporary id was remapped', async () => {
    const result = await read([row('tmp_1')], [], ['tmp_1']);
    expect(mergeMessageRead(result, [row('server_1')], options).map((m) => m.id)).toEqual([
      'server_1',
    ]);
  });

  it('accepts remote deletions on the next fresh read instead of retaining ghosts', async () => {
    const local = [row('1')];
    expect(mergeMessageRead(await read(local, []), local, options)).toEqual([]);
  });

  it('does not resurrect a locally deleted row from a late response', async () => {
    const local = [row('1')];
    expect(mergeMessageRead(await read(local, local), [], options)).toEqual([]);
  });

  it('uses persisted cache only for first paint', () => {
    const cache = [row('1', 'old')];
    const local = [row('1', 'new'), row('2')];
    expect(mergeMessageRead(cache, local, { ...options, cache: true })).toBe(local);
    expect(mergeMessageRead(cache, [], { ...options, cache: true })).toEqual(cache);
  });

  it('does not reuse another conversation boundary', async () => {
    const result = await read([], []);
    expect(mergeMessageRead(result, [row('2')], { key: 'topic-b' })).toEqual([]);
  });

  it('accepts unrelated new server rows while protecting the local send', async () => {
    const start = row('1');
    const result = await read([start], [start, row('3')]);
    expect(mergeMessageRead(result, [start, row('2')], options).map((m) => m.id)).toEqual([
      '1',
      '2',
      '3',
    ]);
  });
});
