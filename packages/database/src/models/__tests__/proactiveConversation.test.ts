// @vitest-environment node
import type { ProactiveConversationPlan } from '@lobechat/types';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { agents, messages, topics, users } from '../../schemas';
import { ProactiveConversationModel } from '../proactiveConversation';
import { TopicModel } from '../topic';

const db = await getTestDB();
const userId = 'proactive-user';
const otherId = 'proactive-other';
const model = new ProactiveConversationModel(db, userId);
const now = new Date('2026-10-13T10:00:00Z');
const makePlan = (
  overrides: Partial<ProactiveConversationPlan> = {},
): ProactiveConversationPlan => ({
  decision: { idleForSeconds: 731 },
  dueAt: '2026-10-13T09:59:00Z',
  id: 'plan-1',
  sourceMessageId: 'assistant-1',
  sourceUserMessageId: 'user-message-1',
  sourceActivitySequence: 0,
  status: 'scheduled',
  ...overrides,
});
const read = async () => (await db.select().from(topics).where(eq(topics.id, 'topic-1')))[0];

beforeEach(async () => {
  await db.delete(users);
  await db.insert(users).values([{ id: userId }, { id: otherId }]);
  await db.insert(agents).values({ id: 'agent-1', userId });
  await db.insert(topics).values({
    id: 'topic-1',
    userId,
    agentId: 'agent-1',
    metadata: { conversationFeatures: { proactiveMessages: true }, proactiveActivitySequence: 0 },
  });
  await db.insert(messages).values([
    {
      id: 'user-message-1',
      userId,
      topicId: 'topic-1',
      role: 'user',
      content: 'hi',
      createdAt: now,
    },
    {
      id: 'assistant-1',
      userId,
      topicId: 'topic-1',
      role: 'assistant',
      content: 'hello',
      createdAt: now,
    },
  ]);
});
afterEach(async () => {
  await db.delete(users);
});

describe('durable autonomous conversation plans (real DB)', () => {
  it('persists an arbitrary one-shot deadline and restores it through a fresh model instance', async () => {
    await expect(model.schedule('topic-1', makePlan())).resolves.toBe(true);
    const due = await ProactiveConversationModel.listDue(db, now);
    expect(due.map((item) => item.id)).toContain('topic-1');
    const restored = new ProactiveConversationModel(db, userId);
    expect((await restored.claim('topic-1', now))?.id).toBe('plan-1');
  });
  it('never reads or modifies another user’s topic', async () => {
    const stranger = new ProactiveConversationModel(db, otherId);
    expect(await stranger.schedule('topic-1', makePlan())).toBe(false);
    expect(await stranger.noteActivity('topic-1')).toBeUndefined();
    expect(await stranger.claim('topic-1', now)).toBeUndefined();
    expect(await stranger.cancel('topic-1')).toBeUndefined();
  });
  it('claims only once even under concurrent scanners', async () => {
    await model.schedule('topic-1', makePlan());
    const claimed = await Promise.all([model.claim('topic-1', now), model.claim('topic-1', now)]);
    expect(claimed.filter(Boolean)).toHaveLength(1);
    expect((await read()).metadata?.proactivePlan?.status).toBe('running');
  });
  it('does not claim a future plan or a busy conversation', async () => {
    await model.schedule('topic-1', makePlan({ dueAt: '2026-10-14T10:00:00Z' }));
    expect(await model.claim('topic-1', now)).toBeUndefined();
    await model.schedule('topic-1', makePlan());
    await new TopicModel(db, userId).updateMetadata('topic-1', {
      runningOperation: { assistantMessageId: 'assistant-1', operationId: 'ordinary-op' },
    });
    expect(await model.claim('topic-1', now)).toBeUndefined();
  });
  it('cancels when the user replies', async () => {
    await model.schedule('topic-1', makePlan());
    await db.insert(messages).values({
      id: 'user-message-2',
      userId,
      topicId: 'topic-1',
      role: 'user',
      content: 'new input',
      createdAt: new Date(now.getTime() + 1000),
    });
    expect(await model.claim('topic-1', now)).toBeUndefined();
    expect((await read()).metadata?.proactivePlan?.status).toBe('cancelled');
  });
  it('cancels queued activity and refuses a stale model decision even before a new message row exists', async () => {
    await model.schedule('topic-1', makePlan());
    await model.noteActivity('topic-1');
    expect(await model.schedule('topic-1', makePlan())).toBe(false);
    expect((await read()).metadata?.proactiveActivitySequence).toBe(1);
    expect((await read()).metadata?.proactivePlan?.status).toBe('cancelled');
  });
  it('turning off the advanced switch cancels pending plans', async () => {
    await model.schedule('topic-1', makePlan());
    await new TopicModel(db, userId).updateMetadata('topic-1', {
      conversationFeatures: { proactiveMessages: false },
    });
    expect(await model.claim('topic-1', now)).toBeUndefined();
    expect((await read()).metadata?.proactivePlan?.status).toBe('cancelled');
  });
  it('preserves unrelated metadata and merges independent option updates', async () => {
    const topicModel = new TopicModel(db, userId);
    await topicModel.updateMetadata('topic-1', {
      conversationFeatures: { outputTimestamps: true },
    });
    await topicModel.updateMetadata('topic-1', { conversationFeatures: { compressImages: true } });
    expect((await read()).metadata?.conversationFeatures).toMatchObject({
      proactiveMessages: true,
      outputTimestamps: true,
      compressImages: true,
    });
  });
  it('cannot resurrect a cancelled plan or overwrite a newer AI decision', async () => {
    await model.schedule('topic-1', makePlan());
    await model.claim('topic-1', now);
    await model.cancel('topic-1');
    await model.mark('topic-1', 'plan-1', 'sent');
    expect((await read()).metadata?.proactivePlan?.status).toBe('cancelled');
    await model.schedule('topic-1', makePlan({ id: 'plan-2' }));
    await model.mark('topic-1', 'plan-1', 'failed');
    expect((await read()).metadata?.proactivePlan?.id).toBe('plan-2');
  });
  it('continuous autonomous scheduling requires the independent repeat switch', async () => {
    await model.schedule('topic-1', makePlan());
    await model.claim('topic-1', now);
    expect(await model.schedule('topic-1', makePlan({ id: 'plan-2' }))).toBe(false);
    await new TopicModel(db, userId).updateMetadata('topic-1', {
      conversationFeatures: { proactiveRepeats: true },
    });
    expect(await model.schedule('topic-1', makePlan({ id: 'plan-2' }))).toBe(true);
  });
  it('only exposes an operation matching the private proactive message marker', async () => {
    const topicModel = new TopicModel(db, userId);
    await topicModel.updateMetadata('topic-1', {
      runningOperation: { assistantMessageId: 'assistant-1', operationId: 'op-1' },
    });
    expect(await model.runningOperation('topic-1', 'plan-1')).toBeUndefined();
    await db
      .update(messages)
      .set({ metadata: { proactivePlanId: 'plan-1' } })
      .where(eq(messages.id, 'assistant-1'));
    expect(await model.runningOperation('topic-1', 'plan-1')).toBe('op-1');
  });
});
