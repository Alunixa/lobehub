import type { UIChatMessage } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import { getMessageAttachments } from './attachments';

describe('getMessageAttachments', () => {
  it('preserves and deduplicates images, documents, audio and video', () => {
    const message: UIChatMessage = {
      audioList: [{ alt: 'recording.m4a', id: 'audio', url: '/audio' }],
      content: 'text',
      createdAt: 0,
      fileList: [{ fileType: 'text/plain', id: 'doc', name: 'doc.txt', size: 1, url: '/doc' }],
      id: 'message',
      imageList: [
        { alt: 'image.png', id: 'image', url: '/image' },
        { alt: 'image.png', id: 'image', url: '/image' },
      ],
      role: 'user',
      updatedAt: 0,
      videoList: [{ alt: 'clip.mp4', id: 'video', url: '/video' }],
    };
    expect(getMessageAttachments(message).map((file) => file.id)).toEqual([
      'doc',
      'image',
      'video',
      'audio',
    ]);
    expect(getMessageAttachments()).toEqual([]);
  });
});
