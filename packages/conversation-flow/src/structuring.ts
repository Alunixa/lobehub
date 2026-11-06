import type { HelperMaps, IdNode } from './types';

/**
 * Phase 2: Structuring
 * Converts flat parent-child relationships into a tree structure
 * Separates main flow from threaded conversations
 *
 * @param helperMaps - Maps built in indexing phase
 * @returns Root nodes of the main conversation flow (idTree)
 */
export function buildIdTree(helperMaps: HelperMaps): IdNode[] {
  const { childrenMap, messageMap } = helperMaps;

  // Get root message IDs (messages with parentId = null and no threadId)
  const rootIds = childrenMap.get(null) ?? [];
  const mainFlowRootIds = rootIds.filter((id) => {
    const msg = messageMap.get(id);
    return msg && !msg.threadId;
  });

  const roots: IdNode[] = mainFlowRootIds.map((id) => ({ children: [], id }));
  // Long conversations must not consume one JavaScript stack frame per message.
  const pending = [...roots];
  while (pending.length > 0) {
    const node = pending.pop()!;
    node.children = (childrenMap.get(node.id) ?? [])
      .filter((childId) => {
        const child = messageMap.get(childId);
        return child && !child.threadId;
      })
      .map((id) => ({ children: [], id }));
    for (const child of node.children) pending.push(child);
  }
  return roots;
}
