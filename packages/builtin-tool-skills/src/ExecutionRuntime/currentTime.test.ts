import { builtinSkills, CurrentTimeIdentifier } from '@lobechat/builtin-skills';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SkillsManifest } from '../manifest';
import { SkillsManifest as DesktopSkillsManifest } from '../manifest.desktop';
import { SkillsApiName } from '../types';
import { SkillsExecutionRuntime } from './index';

const service = {
  findAll: vi.fn(),
  findById: vi.fn(),
  findByName: vi.fn(),
  readResource: vi.fn(),
};

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('current-time skill and tool', () => {
  it('exposes the no-approval API on both web and desktop', () => {
    for (const manifest of [SkillsManifest, DesktopSkillsManifest]) {
      const api = manifest.api.find((item) => item.name === SkillsApiName.getCurrentTime);
      expect(api?.parameters.required).toEqual([]);
      expect(api?.humanIntervention).toBeUndefined();
    }
  });

  it('registers an activatable built-in skill that calls the clock, not a shell', async () => {
    const runtime = new SkillsExecutionRuntime({ builtinSkills, service });
    const result = await runtime.activateSkill({ name: CurrentTimeIdentifier });
    expect(result.success).toBe(true);
    expect(result.content).toContain('lobe-skills.getCurrentTime');
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('reads fresh seconds without any sandbox or external service', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-20T09:12:07Z'));
    const runtime = new SkillsExecutionRuntime({
      getTimezone: () => 'Asia/Shanghai',
      service,
    });
    const first = await runtime.getCurrentTime({});
    expect(first.success).toBe(true);
    expect(JSON.parse(first.content)).toMatchObject({
      date: '2026-09-20',
      second: 7,
      time: '17:12:07',
      timezone: 'Asia/Shanghai',
      utcOffset: '+08:00',
    });
    vi.setSystemTime(new Date('2026-09-20T09:12:09Z'));
    const second = await runtime.getCurrentTime({});
    expect(JSON.parse(second.content).second).toBe(9);
    expect(second.state).toEqual(JSON.parse(second.content));
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('honors an explicit timezone and rejects invalid input instead of inventing local time', async () => {
    const runtime = new SkillsExecutionRuntime({ getTimezone: () => 'Asia/Shanghai', service });
    expect(JSON.parse((await runtime.getCurrentTime({ timezone: 'UTC' })).content).timezone).toBe(
      'UTC',
    );
    expect((await runtime.getCurrentTime({ timezone: 'invalid' })).success).toBe(false);
    expect((await runtime.getCurrentTime({ timezone: '' })).success).toBe(false);
  });
});
