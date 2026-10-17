import { ConversationFeaturesSchema } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import { MessagesEngine } from '../../engine/messages/MessagesEngine';
import type { Message, PipelineContext } from '../../types';
import { AttachmentRetentionProcessor } from '../AttachmentRetention';

const image = (id: string) => ({ alt: id, id, url: `https://example.com/${id}.png` });
const file = (id: string, fileType = 'text/plain') => ({
  content: `EXTRACTED_${id}`,
  fileType,
  id,
  name: `${id}.${fileType.startsWith('image/') ? 'png' : 'txt'}`,
  size: 10,
  url: `https://example.com/${id}`,
});
const context = (messages: Message[]): PipelineContext => ({
  initialState: { messages: [] },
  isAborted: false,
  messages,
  metadata: {},
});
const run = (
  messages: Message[],
  features: ConstructorParameters<typeof AttachmentRetentionProcessor>[0],
) => new AttachmentRetentionProcessor(features).process(context(messages));

describe('request attachment retention', () => {
  it('is a reference-preserving no-op when both switches are off', async () => {
    const input = context([{ content: 'hello', imageList: [image('a')], role: 'user' }]);
    expect(await new AttachmentRetentionProcessor({ imageRetentionCount: 0 }).process(input)).toBe(
      input,
    );
  });

  it('keeps exactly the newest N images, not the newest N image messages', async () => {
    const messages = [
      { content: 'first text', id: 'a', imageList: [image('1'), image('2')], role: 'user' },
      {
        content: 'second text',
        id: 'b',
        imageList: [image('3'), image('4'), image('5')],
        role: 'user',
      },
      { content: 'latest text without pictures', id: 'c', role: 'user' },
    ];
    const before = structuredClone(messages);
    const result = await run(messages, { imageRetentionCount: 2, limitImages: true });
    expect(result.messages.map((m) => m.imageList)).toEqual([
      [],
      [image('4'), image('5')],
      undefined,
    ]);
    expect(result.messages.map((m) => m.content)).toEqual(messages.map((m) => m.content));
    expect(messages).toEqual(before);
  });

  it('counts documents separately and removes their extracted text without changing originals', async () => {
    const messages = [
      { content: 'old question', fileList: [file('old')], imageList: [image('old')], role: 'user' },
      {
        content: 'new question',
        fileList: [file('new1'), file('new2')],
        imageList: [image('new')],
        role: 'user',
      },
    ];
    const result = await run(messages, { fileRetentionCount: 1, limitFiles: true });
    expect(result.messages[0].fileList).toEqual([]);
    expect(result.messages[1].fileList).toEqual([file('new2')]);
    expect(result.messages[0].imageList).toEqual([image('old')]);
    expect(messages[0].fileList).toEqual([file('old')]);
  });

  it('allows zero and includes current-message attachments in each request limit', async () => {
    const result = await run(
      [
        {
          audioList: [image('audio')],
          content: 'text',
          fileList: [file('f')],
          imageList: [image('i')],
          role: 'user',
          videoList: [image('video')],
        },
      ],
      { fileRetentionCount: 0, imageRetentionCount: 0, limitFiles: true, limitImages: true },
    );
    expect(result.messages[0]).toMatchObject({
      audioList: [],
      content: 'text',
      fileList: [],
      imageList: [],
      videoList: [],
    });
  });

  it('does not count image-format files against the non-image budget', async () => {
    const result = await run(
      [{ content: 'text', fileList: [file('image', 'image/png'), file('doc')], role: 'user' }],
      { fileRetentionCount: 0, limitFiles: true },
    );
    expect(result.messages[0].fileList).toEqual([file('image', 'image/png')]);
  });

  it('classifies unknown binary uploads by their image extension', async () => {
    const picture = { ...file('picture', 'application/octet-stream'), name: 'photo.webp' };
    const result = await run(
      [{ content: '', fileList: [picture, file('document')], role: 'user' }],
      { fileRetentionCount: 0, limitFiles: true },
    );
    expect(result.messages[0].fileList).toEqual([picture]);
  });

  it('shares the non-image quota across documents, videos and audio', async () => {
    const result = await run(
      [
        {
          audioList: [image('a')],
          content: 'text',
          fileList: [file('f')],
          role: 'user',
          videoList: [image('v')],
        },
      ],
      { fileRetentionCount: 2, limitFiles: true },
    );
    expect(result.messages[0]).toMatchObject({
      audioList: [image('a')],
      fileList: [],
      videoList: [image('v')],
    });
  });

  it('filters already-native content while leaving text, tool calls and IDs intact', async () => {
    const messages = [
      {
        content: [
          { image_url: { url: 'old' }, type: 'image_url' },
          { text: 'old text', type: 'text' },
        ],
        role: 'tool',
        tool_call_id: 'call',
      },
      {
        content: [
          { image_url: { url: 'new' }, type: 'image_url' },
          { file: { filename: 'a.pdf' }, type: 'file' },
          { text: 'new text', type: 'text' },
        ],
        role: 'user',
      },
    ];
    const result = await run(messages, {
      fileRetentionCount: 0,
      imageRetentionCount: 1,
      limitFiles: true,
      limitImages: true,
    });
    expect(result.messages[0]).toEqual({
      ...messages[0],
      content: [{ text: 'old text', type: 'text' }],
    });
    expect(result.messages[1].content).toEqual([messages[1].content[0], messages[1].content[2]]);
  });

  it('filters serialized assistant multimodal images without modifying text or signatures', async () => {
    const text = { text: 'answer', thoughtSignature: 'signature', type: 'text' };
    const result = await run(
      [
        {
          content: JSON.stringify([
            { image: 'old', type: 'image' },
            text,
            { image: 'new', type: 'image' },
          ]),
          metadata: { isMultimodal: true },
          role: 'assistant',
        },
      ],
      { imageRetentionCount: 1, limitImages: true },
    );
    expect(result.messages[0].content).toBe(
      JSON.stringify([text, { image: 'new', type: 'image' }]),
    );
  });

  it('removes extracted chunk references only for excluded files', async () => {
    const result = await run(
      [
        {
          chunksList: [
            { fileId: 'a', text: 'a' },
            { fileId: 'b', text: 'b' },
          ],
          content: 'hello',
          fileList: [file('a'), file('b')],
          role: 'user',
        },
      ],
      { fileRetentionCount: 1, limitFiles: true },
    );
    expect(result.messages[0].chunksList).toEqual([{ fileId: 'b', text: 'b' }]);
  });

  it('uses ten when a limit is enabled without a saved count', async () => {
    const result = await run(
      [
        {
          content: '',
          imageList: Array.from({ length: 15 }, (_, i) => image(String(i))),
          role: 'user',
        },
      ],
      { limitImages: true },
    );
    expect(result.messages[0].imageList).toHaveLength(10);
    expect(result.messages[0].imageList[0]).toEqual(image('5'));
  });

  it.each([-1, 1.5, NaN, Infinity])('rejects invalid persisted numeric limit %s', (value) => {
    expect(ConversationFeaturesSchema.safeParse({ imageRetentionCount: value }).success).toBe(
      false,
    );
    expect(ConversationFeaturesSchema.safeParse({ fileRetentionCount: value }).success).toBe(false);
  });

  it('accepts zero and persists both switches and numeric values', () => {
    const features = {
      fileRetentionCount: 0,
      imageRetentionCount: 10,
      limitFiles: true,
      limitImages: true,
    };
    expect(ConversationFeaturesSchema.parse(features)).toEqual(features);
  });

  it('does not turn an attachment-only user message into an empty prompt when the limit is zero', async () => {
    const message = { content: '', imageList: [image('a')], role: 'user' };
    const result = await run([message], { imageRetentionCount: 0, limitImages: true });
    expect(result.messages[0]).toMatchObject({
      content: '[Attachments omitted by request retention settings.]',
      imageList: [],
      role: 'user',
    });
    expect(message.imageList).toEqual([image('a')]);
    expect(message.content).toBe('');
  });

  it('projects 134 historical images to ten and excludes old document extracts in the final model payload', async () => {
    const messages = [
      {
        content: 'earlier user text',
        createdAt: 1,
        fileList: [file('old')],
        id: 'a',
        imageList: Array.from({ length: 134 }, (_, i) => image(String(i))),
        role: 'user' as const,
        updatedAt: 1,
      },
      {
        content: 'latest user text',
        createdAt: 2,
        fileList: [file('new')],
        id: 'b',
        role: 'user' as const,
        updatedAt: 2,
      },
    ];
    const before = structuredClone(messages);
    const result = await new MessagesEngine({
      attachmentRetention: {
        fileRetentionCount: 1,
        imageRetentionCount: 10,
        limitFiles: true,
        limitImages: true,
      },
      capabilities: { isCanUseVision: () => true },
      enableSystemDate: false,
      messages,
      model: 'vision',
      provider: 'openai',
    }).process();
    const json = JSON.stringify(result.messages);
    expect(
      result.messages
        .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
        .filter((p) => p.type === 'image_url'),
    ).toHaveLength(10);
    expect(json).toContain('EXTRACTED_new');
    expect(json).not.toContain('EXTRACTED_old');
    expect(json).toContain('earlier user text');
    expect(json).toContain('latest user text');
    expect(messages).toEqual(before);
  });
});
