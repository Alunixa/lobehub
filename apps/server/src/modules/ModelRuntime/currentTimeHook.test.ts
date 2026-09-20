import type { ChatStreamPayload, GenerateObjectPayload } from '@lobechat/model-runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCurrentTimeHook } from './currentTimeHook';

afterEach(() => vi.useRealTimers());

describe('current time model hooks', () => {
  it('re-reads preferences and time for each chat call, including reused retry payloads', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-20T09:12:00Z'));
    const getSettings = vi.fn().mockResolvedValue({
      injectCurrentTime: true,
      timezone: 'Asia/Shanghai',
    });
    const hooks = createCurrentTimeHook(getSettings);
    const payload: ChatStreamPayload = {
      messages: [{ content: 'hello', role: 'user' }],
      model: 'test',
    };
    await hooks.beforeChat!(payload);
    expect(payload.messages[0].content).toContain('17:12');
    vi.setSystemTime(new Date('2026-09-20T09:14:00Z'));
    await hooks.beforeChat!(payload);
    expect(payload.messages[0].content).toContain('17:14');
    expect(payload.messages).toHaveLength(2);
    getSettings.mockResolvedValue({ injectCurrentTime: false });
    await hooks.beforeChat!(payload);
    expect(payload.messages).toEqual([{ content: 'hello', role: 'user' }]);
    expect(getSettings).toHaveBeenCalledTimes(3);
  });

  it('also covers structured generation without changing schema or tool definitions', async () => {
    const hooks = createCurrentTimeHook(async () => ({ injectCurrentTime: true }));
    const payload: GenerateObjectPayload = {
      messages: [{ content: 'Title this conversation', role: 'user' }],
      model: 'test',
      schema: { name: 'title', schema: { properties: {}, type: 'object' } },
    };
    const schema = payload.schema;
    await hooks.beforeGenerateObject!(payload);
    expect(payload.messages[0].content).toContain('<lobehub_current_time>');
    expect(payload.schema).toBe(schema);
  });

  it('does not opt existing users into the setting', async () => {
    const payload: ChatStreamPayload = {
      messages: [{ content: 'hello', role: 'user' }],
      model: 'test',
    };
    await createCurrentTimeHook(async () => undefined).beforeChat!(payload);
    expect(payload.messages).toEqual([{ content: 'hello', role: 'user' }]);
  });
});
