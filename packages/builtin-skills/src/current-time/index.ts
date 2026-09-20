import type { BuiltinSkill } from '@lobechat/types';

import content from './SKILL.md';

export const CurrentTimeIdentifier = 'current-time';
export const CurrentTimeSkill: BuiltinSkill = {
  avatar: '🕒',
  content,
  description:
    'Get the live current date, weekday and time to the second in the user timezone or another IANA timezone. Use for questions about now, today, the current time or exact seconds. 获取当前日期、星期、时分秒和时区。',
  identifier: CurrentTimeIdentifier,
  name: 'current-time',
  source: 'builtin',
};
