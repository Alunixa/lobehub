/**
 * A suspended depth-first traversal. Yield a child traversal instead of calling
 * it recursively (or using yield*) so conversation length never consumes the
 * JavaScript call stack.
 */
export type Traversal = Generator<Traversal, void, unknown>;

export function runTraversal(root: Traversal): void {
  const stack = [root];
  try {
    while (stack.length > 0) {
      const next = stack.at(-1)!.next();
      if (next.done) stack.pop();
      else stack.push(next.value);
    }
  } finally {
    // Unwind suspended scopes even when a descendant throws. In particular,
    // FlatListBuilder temporarily narrows childrenMap inside try/finally.
    for (let index = stack.length - 1; index >= 0; index--) {
      stack[index].return();
    }
  }
}
