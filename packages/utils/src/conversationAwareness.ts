import type { ConversationFeatures, MessageAwareness } from '@lobechat/types';

import { toRecord } from './object';

/** Add a short, stable suffix only to model input, never the display message. */
export const appendConversationAwareness = <T extends { content: unknown; role: string }>(
  messages: T[],
  features: ConversationFeatures,
): T[] =>
  messages.map((message) => {
    if (
      !features.typingAwareness &&
      !features.inputTimestamps &&
      !features.outputTimestamps &&
      !features.modelIdentity
    )
      return message;
    const record = toRecord(message);
    if (message.role === 'assistantGroup' && Array.isArray(record?.children)) {
      return {
        ...message,
        children: record.children.map((child) => {
          const item = toRecord(child);
          if (!item) return child;
          return appendConversationAwareness(
            [
              {
                ...item,
                content: item.content,
                role: typeof item.role === 'string' ? item.role : 'assistant',
              },
            ],
            features,
          )[0];
        }),
      };
    }
    const awareness = toRecord(toRecord(message)?.metadata)?.awareness as
      MessageAwareness | undefined;
    const fields: string[] = [];
    if (message.role === 'user' && awareness) {
      if (features.typingAwareness && Number.isFinite(awareness.composedForMs)) {
        fields.push(`composed_ms=${awareness.composedForMs}`);
      }
      if (
        features.inputTimestamps &&
        awareness.sentAt &&
        Number.isFinite(Date.parse(awareness.sentAt))
      ) {
        fields.push(`sent_at=${awareness.sentAt}`);
      }
    }
    if (
      message.role === 'assistant' &&
      features.outputTimestamps &&
      awareness &&
      awareness.outputFinishedAt &&
      Number.isFinite(Date.parse(awareness.outputFinishedAt))
    ) {
      fields.push(`output_finished_at=${awareness.outputFinishedAt}`);
      if (Number.isFinite(awareness.responseElapsedMs)) {
        fields.push(`response_elapsed_ms=${awareness.responseElapsedMs} (includes tools/network)`);
      }
    }
    const suffixes: string[] = [];
    if (fields.length > 0) suffixes.push(`<message_timing>${fields.join(';')}</message_timing>`);
    if (message.role === 'assistant' && features.modelIdentity) {
      const model = typeof record?.model === 'string' ? record.model.trim() : undefined;
      const provider = typeof record?.provider === 'string' ? record.provider.trim() : undefined;
      if (model || provider) {
        const identity = JSON.stringify({
          ...(model && { model }),
          ...(provider && { provider }),
        })
          .replaceAll('<', '\\u003c')
          .replaceAll('>', '\\u003e');
        suffixes.push(`<reply_model>${identity}</reply_model>`);
      }
    }
    if (suffixes.length === 0) return message;
    const suffix = `\n${suffixes.join('\n')}`;
    return {
      ...message,
      content:
        typeof message.content === 'string'
          ? message.content + suffix
          : Array.isArray(message.content)
            ? [...message.content, { text: suffix, type: 'text' as const }]
            : suffix,
    };
  });
