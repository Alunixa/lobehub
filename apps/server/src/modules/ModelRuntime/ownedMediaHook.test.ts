// @vitest-environment node
import type { ChatStreamPayload } from '@lobechat/model-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createOwnedMediaHook } from './ownedMediaHook';

const authorize = vi.hoisted(() => vi.fn());
const download = vi.hoisted(() => vi.fn());
vi.mock('@/database/models/file', () => ({
  FileModel: class {
    constructor(
      _db: unknown,
      private userId: string,
      private workspaceId?: string,
    ) {}
    findByIds(ids: string[]) {
      return authorize(this.userId, this.workspaceId, ids);
    }
  },
}));
vi.mock('@/server/services/file', () => ({
  FileService: class {
    getFileByteArray = download;
  },
}));
vi.mock('@/envs/app', () => ({ appEnv: { APP_URL: 'https://owned.example' } }));

let sequence = 0;
let id: string;
let version: number;
let accessible: boolean;
const imagePayload = (): ChatStreamPayload => ({
  model: 'fixture',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `https://owned.example/f/${id}`, detail: 'high' } },
      ],
    },
  ],
});
const run = async (userId = 'owner', workspaceId?: string) => {
  const payload = imagePayload();
  await createOwnedMediaHook({} as never, userId, workspaceId).beforeChat?.(payload, undefined);
  return payload.messages[0].content;
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
  vi.clearAllMocks();
  id = `file_cache_${++sequence}`;
  version = 1;
  accessible = true;
  authorize.mockImplementation(async () =>
    accessible
      ? [
          {
            id,
            url: `objects/${id}`,
            fileType: 'image/png',
            fileHash: 'stable',
            updatedAt: version,
          },
        ]
      : [],
  );
  download.mockResolvedValue(new TextEncoder().encode('original-image-bytes'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('authorized historical media reuse', () => {
  it('reuses the complete same image after a long model turn and during an active conversation', async () => {
    const first = await run();
    vi.setSystemTime(new Date('2026-10-14T10:13:00Z'));
    expect(await run()).toEqual(first);
    vi.setSystemTime(new Date('2026-10-14T10:40:00Z'));
    expect(await run()).toEqual(first);
    expect(download).toHaveBeenCalledTimes(1);
    expect(authorize).toHaveBeenCalledTimes(3);
    expect(first).toEqual([
      {
        type: 'image_url',
        image_url: { detail: 'high', url: 'data:image/png;base64,b3JpZ2luYWwtaW1hZ2UtYnl0ZXM=' },
      },
    ]);
  });
  it('does not serve an image after access is revoked even when it is cached', async () => {
    await run();
    accessible = false;
    await expect(run()).rejects.toThrow('Media attachment not found or inaccessible');
    expect(download).toHaveBeenCalledTimes(1);
  });
  it('refreshes changed attachments and keeps user and workspace caches separate', async () => {
    await run('owner', 'workspace');
    version++;
    await run('owner', 'workspace');
    await run('another', 'workspace');
    await run('owner', 'another-workspace');
    expect(download).toHaveBeenCalledTimes(4);
  });
  it('shares an in-flight image download across simultaneous authorized turns', async () => {
    let complete!: (value: Uint8Array) => void;
    download.mockImplementationOnce(
      () =>
        new Promise<Uint8Array>((resolve) => {
          complete = resolve;
        }),
    );
    const first = run();
    const second = run();
    await vi.waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    complete(new TextEncoder().encode('original-image-bytes'));
    expect(await first).toEqual(await second);
    expect(authorize).toHaveBeenCalledTimes(2);
  });
  it('releases a failed in-flight download so a later explicitly requested turn can load it', async () => {
    download.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(run()).rejects.toThrow('storage unavailable');
    expect((await run())?.[0]).toMatchObject({ type: 'image_url' });
    expect(download).toHaveBeenCalledTimes(2);
  });
});
