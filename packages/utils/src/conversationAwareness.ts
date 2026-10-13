import type { ConversationFeatures, MessageAwareness } from '@lobechat/types';

import { toRecord } from './object';

/** Add a short, stable suffix only to model input, never the display message. */
export const appendConversationAwareness = <T extends { content: unknown; role: string }>(
  messages: T[],
  features: ConversationFeatures,
): T[] =>
  messages.map((message) => {
    const awareness = toRecord(toRecord(message)?.metadata)?.awareness as
      MessageAwareness | undefined;
    if (!awareness) return message;
    const fields: string[] = [];
    if (message.role === 'user') {
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
      awareness.outputFinishedAt &&
      Number.isFinite(Date.parse(awareness.outputFinishedAt))
    ) {
      fields.push(`output_finished_at=${awareness.outputFinishedAt}`);
      if (Number.isFinite(awareness.responseElapsedMs)) {
        fields.push(`response_elapsed_ms=${awareness.responseElapsedMs} (includes tools/network)`);
      }
    }
    if (fields.length === 0) return message;
    const suffix = `\n<message_timing>${fields.join(';')}</message_timing>`;
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
