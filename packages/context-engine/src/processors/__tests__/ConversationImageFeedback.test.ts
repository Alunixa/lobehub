import { describe, expect, it } from 'vitest';

import { MessagesEngine } from '../../engine/messages/MessagesEngine';
import type { Message } from '../../types';

const plugin = {
  apiName: 'generateImage',
  arguments: '{"prompt":"Snow"}',
  id: 'generate',
  identifier: 'lobe-image-generation',
  type: 'builtin',
};

const other = { ...plugin, id: 'other', identifier: 'another-tool' };
const output: Message = {
  content: 'Runtime inputs: {"size":"3840x2160"}',
  plugin,
  pluginState: {
    images: [
      { fileId: 'file_first', url: 'https://irrelevant.example/untrusted' },
      { fileId: 'file_second' },
    ],
  },
  role: 'tool',
  tool_call_id: plugin.id,
};
const messages: Message[] = [
  { content: 'Draw snow', role: 'user' },
  { content: '', role: 'assistant', tools: [plugin, other] },
  output,
  { content: 'Other result', plugin: other, role: 'tool', tool_call_id: other.id },
];
const run = async (input = messages, { vision = true, tools = true, limitImages = false } = {}) =>
  (
    await new MessagesEngine({
      attachmentRetention: { imageRetentionCount: 1, limitImages },
      capabilities: { isCanUseFC: () => tools, isCanUseVision: () => vision },
      messages: input as never,
      model: 'fixture',
      provider: 'fixture',
    }).process()
  ).messages.filter((message) => message.role !== 'system');

describe('generated images in the next model request', () => {
  it('projects saved images after all paired text tool results, without trusting saved URLs', async () => {
    const result = await run();
    expect(result.map((message) => message.role)).toEqual([
      'user',
      'assistant',
      'tool',
      'tool',
      'user',
    ]);
    expect(result[2].content).toBe(output.content);
    expect(result[4].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: expect.stringContaining('Review the generated images') }),
        expect.objectContaining({ image_url: { detail: 'auto', url: '/f/file_first' } }),
        expect.objectContaining({ image_url: { detail: 'auto', url: '/f/file_second' } }),
      ]),
    );
    expect(JSON.stringify(result)).not.toContain('irrelevant.example');
  });

  it('keeps earlier images as context without asking to review them every turn', async () => {
    const result = await run([...messages, { content: 'Keep the character', role: 'user' }]);
    expect(JSON.stringify(result)).toContain('Previously generated image context');
    expect(JSON.stringify(result)).not.toContain('Review the generated images');
  });

  it('does not pretend a text-only model saw the generated pixels', async () => {
    const result = JSON.stringify(await run(messages, { tools: false, vision: false }));
    expect(result).not.toContain('image_url');
    expect(result).toContain('no vision input');
    expect(result).toContain('file_first');
  });

  it('respects the normal request image retention limit', async () => {
    const result = JSON.stringify(await run(messages, { limitImages: true }));
    expect(result).not.toContain('/f/file_first');
    expect(result).toContain('/f/file_second');
  });
});
