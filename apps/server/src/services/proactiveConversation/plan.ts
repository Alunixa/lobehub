import { randomUUID } from 'node:crypto';

import type { ProactiveDecision } from '@lobechat/types';

import { ProactiveConversationModel } from '@/database/models/proactiveConversation';
import type { LobeChatDatabase } from '@/database/type';

export const resolveProactiveDueAt = (decision: ProactiveDecision, now = new Date()) => {
  const due = decision.sendAt
    ? Date.parse(decision.sendAt)
    : now.getTime() + (decision.idleForSeconds ?? 0) * 1000;
  if (!Number.isFinite(due) || due <= now.getTime() || due - now.getTime() > 366 * 24 * 3600 * 1000)
    return;
  return new Date(due).toISOString();
};

export async function persistProactiveDecision(
  db: LobeChatDatabase,
  userId: string,
  topicId: string,
  sourceMessageId: string,
  sourceUserMessageId: string | undefined,
  decision: ProactiveDecision,
  threadId?: string,
  sourceActivitySequence = 0,
) {
  const dueAt = resolveProactiveDueAt(decision);
  if (!dueAt || !sourceUserMessageId) return false;
  return new ProactiveConversationModel(db, userId).schedule(topicId, {
    decision,
    dueAt,
    id: randomUUID(),
    sourceMessageId,
    sourceUserMessageId,
    sourceActivitySequence,
    status: 'scheduled',
    threadId,
  });
}
