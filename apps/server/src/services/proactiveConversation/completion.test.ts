// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NotificationModel } from '@/database/models/notification';
import { ProactiveConversationModel } from '@/database/models/proactiveConversation';
import type { LobeChatDatabase } from '@/database/type';

import { completeProactiveConversation } from './completion';
import { WebPushService } from './WebPushService';

afterEach(() => vi.restoreAllMocks());
const findTopic = vi.hoisted(() => vi.fn());
vi.mock('@/database/models/topic', () => ({
  TopicModel: class {
    findById = findTopic;
  },
}));
const database = (reply: string | undefined) =>
  ({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => (reply === undefined ? [] : [{ content: reply }]),
          }),
        }),
      }),
    }),
  }) as unknown as LobeChatDatabase;
const topic = (notifications = true) => ({
  title: 'Fixture topic',
  metadata: {
    conversationFeatures: { proactiveMessages: true, proactiveNotifications: notifications },
    proactivePlan: { id: 'plan', status: 'running' },
  },
});

describe('autonomous reply notification lifecycle', () => {
  it('marks a normal reply sent even when notifications are independently off', async () => {
    findTopic.mockResolvedValue(topic(false));
    const mark = vi.spyOn(ProactiveConversationModel.prototype, 'mark').mockResolvedValue();
    const create = vi.spyOn(NotificationModel.prototype, 'create');
    await completeProactiveConversation(
      database('Visible answer'),
      'user',
      'topic',
      'plan',
      'op',
      true,
      'agent',
    );
    expect(mark).toHaveBeenCalledWith('topic', 'plan', 'sent', 'op');
    expect(create).not.toHaveBeenCalled();
  });
  it('does not create a notification for an explicit silent decision', async () => {
    findTopic.mockResolvedValue(topic());
    const mark = vi.spyOn(ProactiveConversationModel.prototype, 'mark').mockResolvedValue();
    const create = vi.spyOn(NotificationModel.prototype, 'create');
    await completeProactiveConversation(
      database(undefined),
      'user',
      'topic',
      'plan',
      'op',
      true,
      'agent',
    );
    expect(mark).toHaveBeenCalledWith('topic', 'plan', 'skipped', 'op');
    expect(create).not.toHaveBeenCalled();
  });
  it('uses a deduplicated durable notification and pushes only its visible content', async () => {
    findTopic.mockResolvedValue(topic());
    vi.spyOn(ProactiveConversationModel.prototype, 'mark').mockResolvedValue();
    const create = vi.spyOn(NotificationModel.prototype, 'create').mockResolvedValue({
      id: 'notice',
      content: 'Visible answer',
      title: 'Fixture topic',
    } as never);
    const send = vi.spyOn(WebPushService.prototype, 'send').mockResolvedValue();
    await completeProactiveConversation(
      database('Visible answer'),
      'user',
      'topic',
      'plan',
      'op',
      true,
      'agent',
    );
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ dedupeKey: 'proactive:plan' }));
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Visible answer', id: 'notice' }),
    );
  });
  it('does not push again when the dedupe record already exists', async () => {
    findTopic.mockResolvedValue(topic());
    vi.spyOn(ProactiveConversationModel.prototype, 'mark').mockResolvedValue();
    vi.spyOn(NotificationModel.prototype, 'create').mockResolvedValue(null);
    const send = vi.spyOn(WebPushService.prototype, 'send');
    await completeProactiveConversation(
      database('Visible answer'),
      'user',
      'topic',
      'plan',
      'op',
      true,
      'agent',
    );
    expect(send).not.toHaveBeenCalled();
  });
  it('does not notify an old reply after a newer user activity sequence', async () => {
    findTopic.mockResolvedValue({
      ...topic(),
      metadata: { ...topic().metadata, proactiveActivitySequence: 2 },
    } as never);
    const create = vi.spyOn(NotificationModel.prototype, 'create');
    await completeProactiveConversation(
      database('Visible answer'),
      'user',
      'topic',
      'plan',
      'op',
      true,
      'agent',
      undefined,
      1,
    );
    expect(create).not.toHaveBeenCalled();
  });
});
