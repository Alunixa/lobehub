import { toRecord } from './object';

const DATA_IMAGE_PATTERN = /data:image\/[\w.+-]+(?:;[\w=.-]+)*;base64,[\w+/=-]*/gi;
const HTML_IMAGE_PATTERN = /<img\b[^>]*>/gi;
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\(\s*(?:<[^>]+>|[^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/g;
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(\s*(?:<[^>]+>|[^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/g;
const URL_PATTERN = /\b(?:https?|ftp):\/\/[^\s<>"'()[\]]+/gi;
const LONG_BASE64_PATTERN = /(?<![\w+/])[\w+/]{128,}={0,2}(?![\w+/])/g;

/**
 * Keep only text that is useful for memory extraction and semantic search.
 * Media URLs and encoded payloads are transport data, not memory content.
 */
export const sanitizeHumanMemoryText = (value: string): string =>
  value
    .replaceAll(HTML_IMAGE_PATTERN, ' ')
    .replaceAll(MARKDOWN_IMAGE_PATTERN, ' ')
    .replaceAll(DATA_IMAGE_PATTERN, ' ')
    .replaceAll(LONG_BASE64_PATTERN, ' ')
    .replaceAll(MARKDOWN_LINK_PATTERN, '$1')
    .replaceAll(URL_PATTERN, ' ')
    .replaceAll(/\r\n?/g, '\n')
    .replaceAll(/[ \t]{2,}/g, ' ')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();

export const humanMemoryText = (content: unknown): string => {
  if (typeof content === 'string') return sanitizeHumanMemoryText(content);
  if (!Array.isArray(content)) return '';
  return sanitizeHumanMemoryText(
    content
      .map((part) => {
        const value = toRecord(part);
        return value?.type === 'text' && typeof value.text === 'string' ? value.text : '';
      })
      .join(''),
  );
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
