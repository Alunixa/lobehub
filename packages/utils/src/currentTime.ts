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
 * Add a fresh minute-resolution request snapshot, replacing only our own system message.
 * The original messages and user content are never mutated or persisted.
 */
export const withCurrentTime = <T extends { content: unknown; role: string }>(
  messages: T[],
  settings: RequestTimeSettings,
): (T | TimeContextMessage)[] => {
  const clean = messages.filter(
    (message) =>
      !(
        message.role === 'system' &&
        typeof message.content === 'string' &&
        message.content.startsWith(TIME_CONTEXT_START) &&
        message.content.endsWith(TIME_CONTEXT_END)
      ),
  );
  if (!settings.injectCurrentTime) return clean;

  const current = getCurrentTime(settings.timezone);
  return [
    {
      content: `${TIME_CONTEXT_START}
Current date and time: ${current.date} ${current.time.slice(0, 5)}
Weekday: ${current.weekday}
Timezone: ${current.timezone} (UTC${current.utcOffset})
This is the time at this model request, accurate to the minute. For live seconds, call lobe-skills.getCurrentTime when available; do not invent seconds or reuse an earlier time result.
${TIME_CONTEXT_END}`,
      role: 'system',
    },
    ...clean,
  ];
};
