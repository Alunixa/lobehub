import { and, desc, eq, sql } from 'drizzle-orm';

import { NotificationModel } from '@/database/models/notification';
import { ProactiveConversationModel } from '@/database/models/proactiveConversation';
import { TopicModel } from '@/database/models/topic';
import { messages } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import { WebPushService } from './WebPushService';

export async function completeProactiveConversation(
  db: LobeChatDatabase,
  userId: string,
  topicId: string,
  planId: string,
  operationId: string,
  success: boolean,
  agentId: string,
  workspaceId?: string,
  expectedActivitySequence?: number,
) {
  const model = new ProactiveConversationModel(db, userId);
  if (!success) {
    await model.mark(topicId, planId, 'failed', operationId);
    return;
  }
  const topic = await new TopicModel(db, userId, workspaceId).findById(topicId);
  if (
    expectedActivitySequence !== undefined &&
    (topic?.metadata?.proactiveActivitySequence ?? 0) !== expectedActivitySequence
  )
    return;
  if (
    !topic?.metadata?.conversationFeatures?.proactiveMessages ||
    (topic.metadata.proactivePlan?.id === planId &&
      topic.metadata.proactivePlan.status === 'cancelled')
  )
    return;

  const [reply] = await db
    .select({ content: messages.content })
    .from(messages)
    .where(
      and(
        eq(messages.topicId, topicId),
        eq(messages.userId, userId),
        eq(messages.role, 'assistant'),
        sql`${messages.metadata}->>'proactivePlanId' = ${planId}`,
        sql`(${messages.tools} IS NULL OR ${messages.tools} = '[]'::jsonb)`,
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(1);
  if (!reply?.content || reply.content === '...') {
    await model.mark(topicId, planId, 'skipped', operationId);
    return;
  }
  await model.mark(topicId, planId, 'sent', operationId);
  if (!topic.metadata.conversationFeatures.proactiveNotifications) return;
  const url = `/agent/${encodeURIComponent(agentId)}/${encodeURIComponent(topicId)}`;
  const notification = await new NotificationModel(db, userId).create({
    actionUrl: url,
    category: 'conversation',
    content: reply.content.slice(0, 256),
    dedupeKey: `proactive:${planId}`,
    title: topic.title || 'AI',
    type: 'proactive_message',
  });
  if (!notification) return;
  await new WebPushService(db, userId).send({
    body: notification.content,
    id: notification.id,
    title: notification.title,
    url,
  });
}
