import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCurrentTime, resolveTimeZone, withCurrentTime } from './currentTime';

afterEach(() => vi.useRealTimers());

describe('current time', () => {
  it('returns a consistent local date, seconds, weekday, offset and UTC instant', () => {
    expect(getCurrentTime('Asia/Shanghai', new Date('2026-09-20T16:01:07Z'))).toEqual({
      date: '2026-09-21',
      day: 21,
      hour: 0,
      iso8601: '2026-09-20T16:01:07.000Z',
      minute: 1,
      month: 9,
      second: 7,
      time: '00:01:07',
      timezone: 'Asia/Shanghai',
      unixTimestamp: 1789920067,
      utcOffset: '+08:00',
      weekday: 'Monday',
      year: 2026,
    });
  });

  it('handles year boundaries and half-hour timezones', () => {
    const result = getCurrentTime('Asia/Kolkata', new Date('2026-12-31T18:30:00Z'));
    expect(result).toMatchObject({
      date: '2027-01-01',
      time: '00:00:00',
      utcOffset: '+05:30',
    });
  });

  it('uses the actual DST offset for the sampled instant', () => {
    expect(getCurrentTime('America/New_York', new Date('2026-03-08T06:59:59Z'))).toMatchObject({
      time: '01:59:59',
      utcOffset: '-05:00',
    });
    expect(getCurrentTime('America/New_York', new Date('2026-03-08T07:00:00Z'))).toMatchObject({
      time: '03:00:00',
      utcOffset: '-04:00',
    });
  });

  it('falls back safely for missing or stale saved timezones', () => {
    expect(resolveTimeZone()).toBe('UTC');
    expect(resolveTimeZone('not-a-timezone')).toBe('UTC');
    expect(getCurrentTime(null).utcOffset).toBe('+00:00');
  });
});

describe('request time context', () => {
  const messages = [
    { content: 'You are helpful.', role: 'system' },
    {
      content: [{ image_url: { url: 'data:image/png;base64,example' }, type: 'image_url' }],
      role: 'user',
    },
  ];

  it('is off by default and preserves existing content', () => {
    expect(withCurrentTime(messages, {})).toEqual(messages);
  });

  it('adds minutes but not seconds, without modifying original messages', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-20T09:12:57Z'));
    const result = withCurrentTime(messages, {
      injectCurrentTime: true,
      timezone: 'Asia/Shanghai',
    });
    const timePart = (result[1].content as Array<{ text?: string }>).at(-1)?.text;
    expect(timePart).toContain('2026-09-20 17:12');
    expect(timePart).toContain('Sunday');
    expect(timePart).toContain('Asia/Shanghai (UTC+08:00)');
    expect(timePart).not.toContain('17:12:57');
    expect(result[0]).toBe(messages[0]);
    expect(messages).toHaveLength(2);
    expect(result).toHaveLength(2);
    expect(messages[1].content).toHaveLength(1);
  });

  it('refreshes on subsequent calls and removes the prior snapshot when switched off', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-20T09:12:57Z'));
    const first = withCurrentTime(messages, { injectCurrentTime: true });
    vi.setSystemTime(new Date('2026-09-20T09:13:01Z'));
    const second = withCurrentTime(first, { injectCurrentTime: true });
    expect(second).toHaveLength(2);
    const timePart = (second[1].content as Array<{ text?: string }>).at(-1)?.text;
    expect(timePart).toContain('2026-09-20 09:13');
    expect(timePart).not.toContain('09:12');
    expect(withCurrentTime(second, { injectCurrentTime: false })).toEqual(messages);
  });

  it('does not remove user text even when it contains the reserved tags', () => {
    const user = {
      content: '<lobehub_current_time>my text</lobehub_current_time>',
      role: 'user',
    };
    expect(withCurrentTime([user], {})).toEqual([user]);
  });

  it('keeps the complete historical prefix byte-identical across different minutes', () => {
    vi.useFakeTimers();
    const history = [
      { content: 'Stable system instructions', role: 'system' },
      { content: 'Very long historical context'.repeat(1000), role: 'user' },
      { content: 'Previous answer', role: 'assistant' },
      { content: 'Latest question', role: 'user' },
    ];
    vi.setSystemTime(new Date('2026-10-08T01:00:00Z'));
    const first = withCurrentTime(history, { injectCurrentTime: true });
    vi.setSystemTime(new Date('2026-10-08T01:02:00Z'));
    const next = withCurrentTime(history, { injectCurrentTime: true });
    expect(JSON.stringify(first.slice(0, -1))).toBe(JSON.stringify(next.slice(0, -1)));
    expect(first.at(-1)).not.toEqual(next.at(-1));
    expect(first.at(-1)?.content).toContain('Latest question');
    expect(history.at(-1)?.content).toBe('Latest question');
  });
});
