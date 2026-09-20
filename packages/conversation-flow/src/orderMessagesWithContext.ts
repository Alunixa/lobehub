interface PositionedMessage {
  id: string;
  metadata?: { isCustomContext?: boolean } | null;
  parentId?: string | null;
}

/**
 * A context message keeps its real creation time. Its position is expressed by
 * the parent chain, not a fabricated timestamp. Leave every ordinary message
 * in its original relative order, including alternative branches.
 */
export const orderMessagesWithContext = <T extends PositionedMessage>(messages: T[]): T[] => {
  if (!messages.some((message) => message.metadata?.isCustomContext)) return messages;

  const byId = new Map(messages.map((message) => [message.id, message]));
  const parentsWithOrdinaryDescendants = new Set<string>();
  for (const message of messages) {
    if (message.metadata?.isCustomContext) continue;
    let parent = message.parentId ? byId.get(message.parentId) : undefined;
    while (parent?.metadata?.isCustomContext && !parentsWithOrdinaryDescendants.has(parent.id)) {
      parentsWithOrdinaryDescendants.add(parent.id);
      parent = parent.parentId ? byId.get(parent.parentId) : undefined;
    }
  }
  const contextsByParent = new Map<string, T[]>();
  for (const message of messages) {
    if (!message.metadata?.isCustomContext || !message.parentId) continue;
    const siblings = contextsByParent.get(message.parentId) ?? [];
    siblings.push(message);
    contextsByParent.set(message.parentId, siblings);
  }

  const result: T[] = [];
  const emitted = new Set<string>();
  const visiting = new Set<string>();
  const emit = (message: T) => {
    if (emitted.has(message.id) || visiting.has(message.id)) return;
    visiting.add(message.id);
    const parent = message.parentId ? byId.get(message.parentId) : undefined;
    if (parent?.metadata?.isCustomContext) emit(parent);
    if (!emitted.has(message.id)) {
      emitted.add(message.id);
      result.push(message);
    }
    visiting.delete(message.id);
    for (const context of contextsByParent.get(message.id) ?? []) {
      if (!parentsWithOrdinaryDescendants.has(context.id)) emit(context);
    }
  };

  for (const message of messages) {
    if (!message.metadata?.isCustomContext) emit(message);
  }
  for (const message of messages) emit(message);
  return result;
};
