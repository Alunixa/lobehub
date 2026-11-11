import { beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeBackgroundConfig } from '@/features/GlobalBackground/config';

import { clearBackgroundDraft, readBackgroundDraft, writeBackgroundDraft } from './draftStorage';

describe('background draft storage', () => {
  beforeEach(() => localStorage.clear());

  it('keeps desktop/mobile/account drafts separate and survives a reload', () => {
    const desktop = normalizeBackgroundConfig({ enabled: true, blur: 10 });
    writeBackgroundDraft('user-a', 'desktop', desktop);
    expect(readBackgroundDraft('user-a', 'desktop')).toEqual(desktop);
    expect(readBackgroundDraft('user-a', 'mobile')).toBeUndefined();
    expect(readBackgroundDraft('user-b', 'desktop')).toBeUndefined();
  });

  it('only removes the saved target, preserving the other device draft', () => {
    writeBackgroundDraft('user', 'desktop', normalizeBackgroundConfig({ blur: 10 }));
    writeBackgroundDraft('user', 'mobile', normalizeBackgroundConfig({ blur: 20 }));
    clearBackgroundDraft('user', 'desktop');
    expect(readBackgroundDraft('user', 'desktop')).toBeUndefined();
    expect(readBackgroundDraft('user', 'mobile')?.blur).toBe(20);
  });

  it('ignores drafts older than seven days', () => {
    writeBackgroundDraft('user', 'desktop', normalizeBackgroundConfig({ blur: 10 }));
    const spy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 8 * 24 * 60 * 60 * 1000);
    expect(readBackgroundDraft('user', 'desktop')).toBeUndefined();
    spy.mockRestore();
  });
});
