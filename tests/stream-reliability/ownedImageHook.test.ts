import type { ChatStreamPayload } from '@lobechat/model-runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '@/database/type';
import { createOwnedMediaHook } from '@/server/modules/ModelRuntime/ownedMediaHook';

import { buildGooglePart } from '../../packages/model-runtime/src/core/contextBuilders/google';

const mocks = vi.hoisted(() => ({ read: vi.fn(), find: vi.fn() }));
vi.mock('@/envs/app', () => ({ appEnv: { APP_URL: 'https://self.test:3210' } }));
vi.mock('@/database/models/file', () => ({
  FileModel: class {
    findByIds = mocks.find;
  },
}));
vi.mock('@/server/services/file', () => ({
  FileService: class {
    getFileByteArray = mocks.read;
  },
}));

const db = {} as LobeChatDatabase;
const payload = (ids: string[]): ChatStreamPayload => ({
  messages: [
    { content: 'unchanged system', role: 'system' },
    {
      content: ids.map((id) => ({
        image_url: { url: `https://self.test:3210/f/${id}` },
        type: 'image_url' as const,
      })),
      role: 'user',
    },
  ],
  model: 'fixture',
});
const files = (ids: string[]) =>
  ids.map((id) => ({
    fileHash: 'immutable',
    fileType: 'image/png',
    id,
    updatedAt: '2026-10-08',
    url: `owned/${id}`,
  }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.read.mockResolvedValue(new Uint8Array([1, 2, 3]));
});

describe('authenticated historical image preparation', () => {
  it('passes owned video bytes to Gemini inlineData instead of asking it to fetch the file proxy URL', async () => {
    mocks.find.mockResolvedValue([{ ...files(['file_video'])[0], fileType: 'video/mp4' }]);
    const input: ChatStreamPayload = {
      model: 'gemini-fixture',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'video_url', video_url: { url: 'https://self.test:3210/f/file_video' } },
          ],
        },
      ],
    };
    await createOwnedMediaHook(db, 'video-owner').beforeChat!(input);
    const content = input.messages[0].content;
    if (!Array.isArray(content)) throw new Error('Expected video content');
    expect(content[0]).toEqual({
      type: 'video_url',
      video_url: { url: 'data:video/mp4;base64,AQID' },
    });
    expect(await buildGooglePart(content[0], { model: 'gemini-fixture' })).toMatchObject({
      inlineData: { data: 'AQID', mimeType: 'video/mp4' },
    });
  });

  it('also resolves owned audio without exposing an authenticated proxy link upstream', async () => {
    mocks.find.mockResolvedValue([{ ...files(['file_audio'])[0], fileType: 'audio/mpeg' }]);
    const input: ChatStreamPayload = {
      model: 'fixture',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'audio_url', audio_url: { url: 'https://self.test:3210/f/file_audio' } },
          ],
        },
      ],
    };
    await createOwnedMediaHook(db, 'audio-owner').beforeChat!(input);
    expect(JSON.stringify(input.messages)).toContain('data:audio/mpeg;base64,AQID');
    expect(JSON.stringify(input.messages)).not.toContain('/f/file_audio');
  });
  it('reads owned storage directly and caches the bytes without changing the historical system prefix', async () => {
    mocks.find.mockResolvedValue(files(['file_a']));
    const hooks = createOwnedMediaHook(db, 'warm-user');
    const first = payload(['file_a']);
    const next = payload(['file_a']);
    const system = first.messages[0];
    await hooks.beforeChat!(first);
    await hooks.beforeChat!(next);
    expect(mocks.read).toHaveBeenCalledTimes(1);
    expect(mocks.find).toHaveBeenCalledTimes(2);
    expect(first.messages[0]).toBe(system);
    expect(first.messages[1].content).toEqual(next.messages[1].content);
    expect(JSON.stringify(first.messages[1].content)).toContain('data:image/png;base64,AQID');
  });

  it('reauthorizes cached images instead of exposing deleted or foreign attachments', async () => {
    mocks.find.mockResolvedValueOnce(files(['file_b'])).mockResolvedValueOnce([]);
    const hooks = createOwnedMediaHook(db, 'isolation-user');
    await hooks.beforeChat!(payload(['file_b']));
    await expect(hooks.beforeChat!(payload(['file_b']))).rejects.toThrow('inaccessible');
    expect(mocks.read).toHaveBeenCalledTimes(1);
  });

  it('leaves external URLs to the SSRF-safe provider path', async () => {
    const input: ChatStreamPayload = {
      messages: [
        {
          content: [{ image_url: { url: 'http://127.0.0.1/f/file_private' }, type: 'image_url' }],
          role: 'user',
        },
      ],
      model: 'fixture',
    };
    await createOwnedMediaHook(db, 'external-user').beforeChat!(input);
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
    expect(JSON.stringify(input.messages)).toContain('http://127.0.0.1/f/file_private');
  });

  it('preserves all 86 historical images rather than silently trimming the conversation', async () => {
    const ids = Array.from({ length: 86 }, (_, i) => `file_history${i}`);
    mocks.find.mockResolvedValue(files(ids));
    const hook = createOwnedMediaHook(db, 'long-topic');
    const first = payload(ids);
    await hook.beforeChat!(first);
    expect(first.messages[1].content).toHaveLength(86);
    expect(mocks.read).toHaveBeenCalledTimes(86);
    await hook.beforeChat!(payload(ids));
    expect(mocks.read).toHaveBeenCalledTimes(86);
  });
});
