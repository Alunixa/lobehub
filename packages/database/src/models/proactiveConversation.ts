import type { ProactiveConversationPlan } from '@lobechat/types';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { messages, topics } from '../schemas';
import type { LobeChatDatabase } from '../type';

/** Durable single-shot plans live with their topic; no browser timer is authoritative. */
export class ProactiveConversationModel {
  constructor(
    private readonly db: LobeChatDatabase,
    private readonly userId: string,
  ) {}

  static listDue(db: LobeChatDatabase, now = new Date()) {
    return db
      .select({ id: topics.id, userId: topics.userId, workspaceId: topics.workspaceId })
      .from(topics)
      .where(
        and(
          isNull(topics.groupId),
          sql`${topics.metadata}->'proactivePlan'->>'status' = 'scheduled'`,
          sql`${topics.metadata}->'proactivePlan'->>'dueAt' <= ${now.toISOString()}`,
        ),
      )
      .orderBy(sql`${topics.metadata}->'proactivePlan'->>'dueAt'`)
      .limit(20);
  }

  async schedule(topicId: string, plan: ProactiveConversationPlan): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [topic] = await tx
        .select()
        .from(topics)
        .where(and(eq(topics.id, topicId), eq(topics.userId, this.userId)))
        .for('update');
      if (!topic || topic.groupId || !topic.metadata?.conversationFeatures?.proactiveMessages)
        return false;
      if ((topic.metadata.proactiveActivitySequence ?? 0) !== (plan.sourceActivitySequence ?? 0))
        return false;
      if (
        topic.metadata.proactivePlan?.status === 'running' &&
        topic.metadata.proactivePlan.sourceActivitySequence === plan.sourceActivitySequence &&
        topic.metadata.conversationFeatures.proactiveRepeats !== true
      )
        return false;
      const [lastUser] = await tx
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.topicId, topicId),
            eq(messages.userId, this.userId),
            eq(messages.role, 'user'),
            plan.threadId ? eq(messages.threadId, plan.threadId) : isNull(messages.threadId),
          ),
        )
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(1);
      if (lastUser?.id !== plan.sourceUserMessageId) return false;
      await tx
        .update(topics)
        .set({
          metadata: { ...topic.metadata, proactivePlan: plan },
        })
        .where(and(eq(topics.id, topicId), eq(topics.userId, this.userId)));
      return true;
    });
  }

  async cancel(topicId: string): Promise<ProactiveConversationPlan | undefined> {
    return this.db.transaction(async (tx) => {
      const [topic] = await tx
        .select({ metadata: topics.metadata })
        .from(topics)
        .where(and(eq(topics.id, topicId), eq(topics.userId, this.userId)))
        .for('update');
      const plan = topic?.metadata?.proactivePlan;
      if (!plan || !['scheduled', 'running'].includes(plan.status)) return undefined;
      await tx
        .update(topics)
        .set({
          metadata: { ...topic.metadata, proactivePlan: { ...plan, status: 'cancelled' } },
        })
        .where(and(eq(topics.id, topicId), eq(topics.userId, this.userId)));
      return plan;
    });
  }

  async noteActivity(topicId: string) {
    return this.db.transaction(async (tx) => {
      const [topic] = await tx
        .select({ metadata: topics.metadata })
        .from(topics)
        .where(and(eq(topics.id, topicId), eq(topics.userId, this.userId)))
        .for('update');
      if (!topic) return;
      const plan = topic.metadata?.proactivePlan;
      const active = plan && ['scheduled', 'running'].includes(plan.status);
      const metadata = {
        ...topic.metadata,
        proactiveActivitySequence: (topic.metadata?.proactiveActivitySequence ?? 0) + 1,
        ...(active && { proactivePlan: { ...plan, status: 'cancelled' as const } }),
      };
      await tx
        .update(topics)
        .set({ metadata })
        .where(and(eq(topics.id, topicId), eq(topics.userId, this.userId)));
      return { metadata, cancelledPlan: active ? plan : undefined };
    });
  }

  async runningOperation(topicId: string, planId: string) {
    const [topic] = await this.db
      .select({ metadata: topics.metadata })
      .from(topics)
      .where(and(eq(topics.id, topicId), eq(topics.userId, this.userId)))
      .limit(1);
    const operation = topic?.metadata?.runningOperation;
    if (!operation) return;
    const [assistant] = await this.db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.id, operation.assistantMessageId),
          eq(messages.userId, this.userId),
          eq(messages.topicId, topicId),
          sql`${messages.metadata}->>'proactivePlanId' = ${planId}`,
        ),
      )
      .limit(1);
    return assistant ? operation.operationId : undefined;
  }

  async claim(topicId: string, now = new Date()): Promise<ProactiveConversationPlan | undefined> {
    return this.db.transaction(async (tx) => {
      const [topic] = await tx
        .select()
        .from(topics)
        .where(and(eq(topics.id, topicId), eq(topics.userId, this.userId)))
        .for('update');
      const plan = topic?.metadata?.proactivePlan;
      if (
        !topic ||
        !plan ||
        plan.status !== 'scheduled' ||
        !Number.isFinite(Date.parse(plan.dueAt)) ||
        Date.parse(plan.dueAt) > now.getTime()
      )
        return undefined;
      const [lastUser] = await tx
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.topicId, topicId),
            eq(messages.userId, this.userId),
            eq(messages.role, 'user'),
            plan.threadId ? eq(messages.threadId, plan.threadId) : isNull(messages.threadId),
          ),
        )
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(1);
      const cancelled =
        !topic.metadata?.conversationFeatures?.proactiveMessages ||
        topic.groupId ||
        lastUser?.id !== plan.sourceUserMessageId ||
        (topic.metadata?.proactiveActivitySequence ?? 0) !== (plan.sourceActivitySequence ?? 0);
      if (!cancelled && topic.metadata?.runningOperation) return undefined;
      const next: ProactiveConversationPlan = {
        ...plan,
        status: cancelled ? 'cancelled' : 'running',
      };
      await tx
        .update(topics)
        .set({ metadata: { ...topic.metadata, proactivePlan: next } })
        .where(and(eq(topics.id, topicId), eq(topics.userId, this.userId)));
      return cancelled ? undefined : next;
    });
  }

  async mark(
    topicId: string,
    planId: string,
    status: 'running' | 'sent' | 'skipped' | 'failed',
    operationId?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [topic] = await tx
        .select({ metadata: topics.metadata })
        .from(topics)
        .where(and(eq(topics.id, topicId), eq(topics.userId, this.userId)))
        .for('update');
      const plan = topic?.metadata?.proactivePlan;
      // Do not overwrite a newer decision, or resurrect a user-cancelled plan.
      if (!plan || plan.id !== planId || plan.status !== 'running') return;
      await tx
        .update(topics)
        .set({
          metadata: {
            ...topic.metadata,
            proactivePlan: { ...plan, ...(operationId && { operationId }), status },
          },
        })
        .where(and(eq(topics.id, topicId), eq(topics.userId, this.userId)));
    });
  }
}
