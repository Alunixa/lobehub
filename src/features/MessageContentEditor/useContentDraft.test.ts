import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useContentDraft, usePersistContentDraft } from './useContentDraft';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('message content draft recovery', () => {
  it('recovers saved text and attachments without mixing accounts or messages', () => {
    const draft = { attachments: [{ id: 'doc', name: 'a.txt', url: '/doc' }], content: 'unsaved' };
    localStorage.setItem('user1:msg1', JSON.stringify(draft));
    expect(
      renderHook(() => useContentDraft('user1:msg1', { attachments: [], content: 'original' }))
        .result.current.initial,
    ).toMatchObject(draft);
    expect(
      renderHook(() => useContentDraft('user2:msg1', { attachments: [], content: 'other' })).result
        .current.initial.content,
    ).toBe('other');
  });
  it('persists content changes and only clears the draft explicitly', () => {
    const { result } = renderHook(() => {
      const draft = useContentDraft('key', { attachments: [], content: 'original' });
      usePersistContentDraft(
        'key',
        { attachments: draft.initial.attachments, content: draft.content },
        draft.setStorageError,
      );
      return draft;
    });
    act(() => result.current.setContent('edited'));
    expect(JSON.parse(localStorage.getItem('key')!).content).toBe('edited');
    act(() => result.current.clear());
    expect(localStorage.getItem('key')).toBeNull();
  });
  it('falls back on malformed storage and surfaces storage quota failures', () => {
    localStorage.setItem('key', '{');
    const draft = renderHook(() =>
      useContentDraft('key', { attachments: [], content: 'fallback' }),
    );
    expect(draft.result.current.initial.content).toBe('fallback');
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('quota');
      },
    });
    const onError = vi.fn();
    renderHook(() => usePersistContentDraft('new', { attachments: [], content: 'x' }, onError));
    expect(onError).toHaveBeenCalledWith(true);
  });
});
