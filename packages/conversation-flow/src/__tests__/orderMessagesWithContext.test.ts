import { describe, expect, it } from 'vitest';

import { orderMessagesWithContext } from '../orderMessagesWithContext';

describe('orderMessagesWithContext', () => {
  it('returns the same input when there is no inserted context', () => {
    const rows = [{ id: 'u1' }, { id: 'a1', parentId: 'u1' }];
    expect(orderMessagesWithContext(rows)).toBe(rows);
  });
  it('does not mutate input or reorder alternative branches', () => {
    const rows = [
      { id: 'u1' },
      { id: 'a1', parentId: 'u1' },
      { id: 'a2', parentId: 'context' },
      { id: 'context', metadata: { isCustomContext: true }, parentId: 'u1' },
    ];
    const snapshot = structuredClone(rows);
    expect(orderMessagesWithContext(rows).map((row) => row.id)).toEqual([
      'u1',
      'a1',
      'context',
      'a2',
    ]);
    expect(rows).toEqual(snapshot);
  });
  it('does not hang on malformed imported context cycles', () => {
    const rows = [
      { id: 'one', metadata: { isCustomContext: true }, parentId: 'two' },
      { id: 'two', metadata: { isCustomContext: true }, parentId: 'one' },
    ];
    expect(new Set(orderMessagesWithContext(rows).map((row) => row.id)).size).toBe(2);
  });
});
