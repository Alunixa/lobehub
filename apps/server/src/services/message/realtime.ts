import { createHash } from 'node:crypto';

import debug from 'debug';

import { getAgentRuntimeRedisClient } from '@/server/modules/AgentRuntime/redis';

const log = debug('lobe-server:message-realtime');

const CHANNEL_PREFIX = 'lobe:messages:v1';

export interface MessageRealtimeContext {
  agentId?: string | null;
  groupId?: string | null;
  sessionId?: string | null;
  threadId?: string | null;
  topicId?: string | null;
}

export type MessageRealtimeReason =
  | 'agent_runtime_end'
  | 'compression'
  | 'create'
  | 'delete'
  | 'edit'
  | 'insert_context'
  | 'update';

interface MessageRealtimeScope {
  userId: string;
  workspaceId?: string | null;
}

const hashChannelIdentity = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('base64url').slice(0, 32);

const normalizeContext = (context: MessageRealtimeContext) => {
  const topicId = context.topicId ?? null;
  if (!topicId) return null;

  if (context.groupId) {
    return {
      groupId: context.groupId,
      threadId: context.threadId ?? null,
      topicId,
      type: 'group' as const,
    };
  }

  const agentOrSessionId = context.agentId ?? context.sessionId ?? null;
  if (!agentOrSessionId) return null;

  return {
    agentOrSessionId,
    threadId: context.threadId ?? null,
    topicId,
    type: 'agent' as const,
  };
};

const principalIdentity = ({ userId, workspaceId }: MessageRealtimeScope) =>
  workspaceId ? { type: 'workspace', workspaceId } : { type: 'user', userId };

export const getMessageRealtimeGlobalChannel = (scope: MessageRealtimeScope): string =>
  `${CHANNEL_PREFIX}:global:${hashChannelIdentity(principalIdentity(scope))}`;

export const getMessageRealtimeConversationChannel = (
  scope: MessageRealtimeScope,
  context: MessageRealtimeContext,
): string | null => {
  const normalizedContext = normalizeContext(context);
  if (!normalizedContext) return null;

  return `${CHANNEL_PREFIX}:conversation:${hashChannelIdentity({
    context: normalizedContext,
    principal: principalIdentity(scope),
  })}`;
};

export const getMessageRealtimeSubscriptionChannels = (
  scope: MessageRealtimeScope,
  context: MessageRealtimeContext,
): string[] => {
  const conversationChannel = getMessageRealtimeConversationChannel(scope, context);
  if (!conversationChannel) return [];

  return [conversationChannel, getMessageRealtimeGlobalChannel(scope)];
};

const publish = async (channel: string, reason: MessageRealtimeReason): Promise<void> => {
  // Avoid constructing the shared Redis client in local/test environments that
  // intentionally run without Redis. Cross-process realtime fan-out requires
  // Redis; focus/reconnect revalidation remains the client fallback.
  if (!process.env.REDIS_URL) return;

  try {
    const redis = getAgentRuntimeRedisClient();
    if (!redis) return;

    await redis.publish(
      channel,
      JSON.stringify({ reason, timestamp: Date.now(), type: 'messages.updated' }),
    );
  } catch (error) {
    // Message persistence is authoritative. Realtime notification is
    // best-effort and must never turn a successful save into a failed request.
    log('publish failed for %s: %O', channel, error);
  }
};

export const publishMessageRealtimeUpdate = async (
  scope: MessageRealtimeScope,
  context: MessageRealtimeContext,
  reason: MessageRealtimeReason,
): Promise<void> => {
  const channel = getMessageRealtimeConversationChannel(scope, context);
  if (!channel) return;

  await publish(channel, reason);
};

export const publishMessageRealtimeGlobalUpdate = async (
  scope: MessageRealtimeScope,
  reason: MessageRealtimeReason,
): Promise<void> => publish(getMessageRealtimeGlobalChannel(scope), reason);
