import { toRecord } from './object';

export const humanMemoryText = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      const value = toRecord(part);
      return value?.type === 'text' && typeof value.text === 'string' ? value.text : '';
    })
    .join('');
};

/** Retain complete user turns; tool exchanges and assistant retries never consume a turn. */
export const buildRecentMemoryWindow = <T>(messages: readonly T[], windowSize = 12): T[] => {
  const rounds = Math.max(1, Math.min(50, Math.floor(windowSize) || 12));
  let found = 0;
  for (let index = messages.length - 1; index >= 0; index--) {
    if (toRecord(messages[index])?.role === 'user' && ++found === rounds)
      return messages.slice(index);
  }
  return messages.some((message) => toRecord(message)?.role)
    ? [...messages]
    : messages.slice(-rounds * 2);
};
