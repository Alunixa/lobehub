/** Validate a saved timezone without letting a stale setting break model requests. */
export const resolveTimeZone = (timezone?: string | null): string => {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: timezone || 'UTC' }).resolvedOptions()
      .timeZone;
  } catch {
    return 'UTC';
  }
};

/** All fields describe the same instant, including across midnight and DST changes. */
export const getCurrentTime = (timezone?: string | null, now = new Date()) => {
  const timeZone = resolveTimeZone(timezone);
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone,
    timeZoneName: 'longOffset',
    weekday: 'long',
    year: 'numeric',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const { year, month, day, hour, minute, second, weekday } = values;
  const utcOffset = values.timeZoneName === 'GMT' ? '+00:00' : values.timeZoneName.slice(3);

  return {
    date: `${year}-${month}-${day}`,
    day: Number(day),
    hour: Number(hour),
    iso8601: now.toISOString(),
    minute: Number(minute),
    month: Number(month),
    second: Number(second),
    time: `${hour}:${minute}:${second}`,
    timezone: timeZone,
    unixTimestamp: Math.floor(now.getTime() / 1000),
    utcOffset,
    weekday,
    year: Number(year),
  };
};

const TIME_CONTEXT_START = '<lobehub_current_time>';
const TIME_CONTEXT_END = '</lobehub_current_time>';

interface TimeContextMessage {
  content: string;
  role: 'system';
}

export interface RequestTimeSettings {
  injectCurrentTime?: boolean;
  timezone?: string | null;
}

/**
 * Add a fresh minute-resolution snapshot at the request tail, not the cacheable prefix.
 * The original messages and user content are never mutated or persisted.
 */
export const withCurrentTime = <T extends { content: unknown; role: string }>(
  messages: T[],
  settings: RequestTimeSettings,
): (T | TimeContextMessage)[] => {
  const clean = messages
    .filter(
      (message) =>
        !(
          message.role === 'system' &&
          typeof message.content === 'string' &&
          message.content.startsWith(TIME_CONTEXT_START) &&
          message.content.endsWith(TIME_CONTEXT_END)
        ),
    )
    .map((message) => {
      if (message.role !== 'user') return message;
      if (typeof message.content === 'string') {
        const index = message.content.lastIndexOf(`\n\n${TIME_CONTEXT_START}`);
        if (
          index >= 0 &&
          message.content.endsWith(TIME_CONTEXT_END) &&
          message.content.slice(index).includes('This is the time at this model request')
        ) {
          return { ...message, content: message.content.slice(0, index) };
        }
      } else if (Array.isArray(message.content)) {
        const parts = message.content.filter(
          (part) =>
            !(
              part?.type === 'text' &&
              typeof part.text === 'string' &&
              part.text.startsWith(TIME_CONTEXT_START) &&
              part.text.endsWith(TIME_CONTEXT_END) &&
              part.text.includes('This is the time at this model request')
            ),
        );
        if (parts.length !== message.content.length) return { ...message, content: parts };
      }
      return message;
    });
  if (!settings.injectCurrentTime) return clean;

  const current = getCurrentTime(settings.timezone);
  const content = `${TIME_CONTEXT_START}
Current date and time: ${current.date} ${current.time.slice(0, 5)}
Weekday: ${current.weekday}
Timezone: ${current.timezone} (UTC${current.utcOffset})
This is the time at this model request, accurate to the minute. For live seconds, call lobe-skills.getCurrentTime when available; do not invent seconds or reuse an earlier time result.
${TIME_CONTEXT_END}`;
  // Providers move system messages ahead of the entire history. A changing
  // timestamp there invalidates every cached token, even on a very long topic.
  const userIndex = clean.findLastIndex((message) => message.role === 'user');
  if (userIndex === -1) return [...clean, { content, role: 'system' }];

  return clean.map((message, index) => {
    if (index !== userIndex) return message;
    if (typeof message.content === 'string') {
      const previousIndex = message.content.lastIndexOf(`\n\n${TIME_CONTEXT_START}`);
      const original =
        previousIndex >= 0 && message.content.endsWith(TIME_CONTEXT_END)
          ? message.content.slice(0, previousIndex)
          : message.content;
      return { ...message, content: `${original}\n\n${content}` };
    }
    if (Array.isArray(message.content)) {
      const parts = message.content.filter(
        (part) =>
          !(
            part?.type === 'text' &&
            typeof part.text === 'string' &&
            part.text.startsWith(TIME_CONTEXT_START) &&
            part.text.endsWith(TIME_CONTEXT_END)
          ),
      );
      return { ...message, content: [...parts, { text: content, type: 'text' }] };
    }
    return { ...message, content };
  });
};
