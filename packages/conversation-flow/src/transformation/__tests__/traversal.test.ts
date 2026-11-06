import { describe, expect, it } from 'vitest';

import type { Traversal } from '../traversal';
import { runTraversal } from '../traversal';

describe('runTraversal', () => {
  it('preserves depth-first execution and scope cleanup at arbitrary depth', () => {
    const entered: number[] = [];
    const exited: number[] = [];
    function* visit(depth: number): Traversal {
      entered.push(depth);
      try {
        if (depth < 25_000) yield visit(depth + 1);
      } finally {
        exited.push(depth);
      }
    }

    runTraversal(visit(0));

    expect(entered).toHaveLength(25_001);
    expect(exited).toEqual([...entered].reverse());
  });

  it('unwinds every suspended ancestor before propagating a descendant failure', () => {
    const scopes: string[] = [];
    const failure = new Error('Descendant failed');
    function* visit(name: string, child?: Traversal): Traversal {
      scopes.push(`enter:${name}`);
      try {
        if (child) yield child;
        else throw failure;
      } finally {
        scopes.push(`exit:${name}`);
      }
    }

    expect(() => runTraversal(visit('root', visit('child', visit('leaf'))))).toThrow(failure);
    expect(scopes).toEqual([
      'enter:root',
      'enter:child',
      'enter:leaf',
      'exit:leaf',
      'exit:child',
      'exit:root',
    ]);
  });
});
