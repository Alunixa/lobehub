import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ragService } from '@/services/rag';
import { useFileStore } from '@/store/file';

import { useMessageAttachments } from './useMessageAttachments';

vi.mock('@/store/file', () => {
  const state = { uploadWithProgress: vi.fn() };
  return { useFileStore: { getState: () => state } };
});
vi.mock('@/services/rag', () => ({ ragService: { parseFileContent: vi.fn() } }));

beforeEach(() =>
  vi.mocked(ragService.parseFileContent).mockResolvedValue({ success: true } as never),
);
afterEach(() => vi.restoreAllMocks());

describe('independent message attachment uploads', () => {
  it('keeps existing attachments and parses an added document before allowing save', async () => {
    vi.spyOn(useFileStore.getState(), 'uploadWithProgress').mockResolvedValue({
      filename: 'new.txt',
      id: 'new',
      url: '/new',
    });
    const { result } = renderHook(() =>
      useMessageAttachments([{ id: 'old', name: 'old.png', url: '/old' }]),
    );
    await act(async () =>
      result.current.addFiles([new File(['context'], 'new.txt', { type: 'text/plain' })]),
    );
    expect(result.current.attachments.map((item) => item.id)).toEqual(['old', 'new']);
    expect(result.current.pending).toEqual([]);
    expect(ragService.parseFileContent).toHaveBeenCalledWith('new');
    act(() => result.current.remove('old'));
    expect(result.current.attachments.map((item) => item.id)).toEqual(['new']);
  });

  it('keeps a failed upload for retry rather than silently dropping it', async () => {
    const upload = vi
      .spyOn(useFileStore.getState(), 'uploadWithProgress')
      .mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useMessageAttachments([]));
    await act(async () =>
      result.current.addFiles([new File(['x'], 'image.png', { type: 'image/png' })]),
    );
    expect(result.current.pending[0].error).toBe(true);
    upload.mockResolvedValueOnce({ id: 'image', url: '/image' });
    await act(async () => result.current.retry(result.current.pending[0]));
    expect(result.current.pending).toEqual([]);
    expect(result.current.attachments[0].id).toBe('image');
  });

  it('does not resurrect a cancelled upload even if its server request eventually succeeds', async () => {
    let resolve!: (value: { id: string; url: string }) => void;
    vi.spyOn(useFileStore.getState(), 'uploadWithProgress').mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const { result } = renderHook(() => useMessageAttachments([]));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.addFiles([new File(['x'], 'image.png', { type: 'image/png' })]);
    });
    await waitFor(() => expect(result.current.pending).toHaveLength(1));
    act(() => result.current.remove(result.current.pending[0].id));
    await act(async () => {
      resolve({ id: 'late', url: '/late' });
      await pending;
    });
    expect(result.current.attachments).toEqual([]);
    expect(result.current.pending).toEqual([]);
  });

  it('blocks completion if document processing fails and aborts pending uploads on unmount', async () => {
    vi.spyOn(useFileStore.getState(), 'uploadWithProgress').mockResolvedValueOnce({
      id: 'doc',
      url: '/doc',
    });
    vi.mocked(ragService.parseFileContent).mockRejectedValueOnce(new Error('parse failed'));
    const { result, unmount } = renderHook(() => useMessageAttachments([]));
    await act(async () =>
      result.current.addFiles([new File(['x'], 'doc.txt', { type: 'text/plain' })]),
    );
    expect(result.current.pending[0].error).toBe(true);
    expect(result.current.attachments).toEqual([]);
    let controller: AbortController | undefined;
    vi.spyOn(useFileStore.getState(), 'uploadWithProgress').mockImplementation((params) => {
      controller = params.abortController;
      return new Promise(() => {});
    });
    act(() => {
      void result.current.retry(result.current.pending[0]);
    });
    unmount();
    expect(controller?.signal.aborted).toBe(true);
  });
});
