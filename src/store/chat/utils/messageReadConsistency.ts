import type { UIChatMessage } from '@lobechat/types';
import isEqual from 'fast-deep-equal';

interface ReadBoundary {
  key: string;
  messages: UIChatMessage[];
  protectedIds: ReadonlySet<string>;
}

// Weak ownership follows the actual response, not the currently selected topic.
// Adapted from upstream #20891/#21083 without introducing the replica migration.
const boundaries = new WeakMap<UIChatMessage[], ReadBoundary>();

export const readMessagesWithBoundary = async (
  boundary: ReadBoundary,
  fetcher: () => Promise<UIChatMessage[]>,
): Promise<UIChatMessage[]> => {
  const data = [...await fetcher()];
  boundaries.set(data, boundary);
  return data;
};

export const mergeMessageRead = (
  fetched: UIChatMessage[],
  local: UIChatMessage[],
  options: { cache?: boolean; key: string; protectedIds?: ReadonlySet<string> },
): UIChatMessage[] => {
  // Storage is a first-paint fallback, never newer than an already loaded bucket.
  if (options.cache && local.length > 0) return local;
  const read = boundaries.get(fetched);
  const boundary = read?.key === options.key ? read : undefined;
  const before = boundary ? new Map(boundary.messages.map((m) => [m.id, m])) : undefined;
  const current = new Map(local.map((m) => [m.id, m]));
  const fetchedIds = new Set(fetched.map((m) => m.id));
  const protectedId = (id: string) =>
    options.protectedIds?.has(id) || boundary?.protectedIds.has(id);
  const changedSinceRead = (message: UIChatMessage) =>
    !!before && !isEqual(before.get(message.id), message);

  const merged = fetched.flatMap((message) => {
    const currentMessage = current.get(message.id);
    // An old read cannot resurrect a row removed after it started.
    if (before?.has(message.id) && !currentMessage) return [];
    if (!currentMessage) return [message];
    if (protectedId(message.id) || changedSinceRead(currentMessage) ||
        currentMessage.updatedAt > message.updatedAt) return [currentMessage];
    return [message];
  });
  for (const message of local) {
    if (!fetchedIds.has(message.id) &&
        (protectedId(message.id) || changedSinceRead(message))) merged.push(message);
  }
  // A later, fresh read remains authoritative about remote deletion. No permanent ghosts.
  merged.sort((a, b) => a.createdAt - b.createdAt);
  return isEqual(merged, local) ? local : merged;
};
