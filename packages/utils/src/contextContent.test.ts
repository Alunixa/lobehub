import { describe, expect, it } from 'vitest';

import { getContextContentEstimate } from './contextContent';

describe('semantic context content estimate', () => {
  it('is invariant to inline image size, encoding and hosted media transport', () => {
    const content = (url: string) => [
      { type: 'text', text: 'describe this' },
      { type: 'image_url', image_url: { url } },
    ];
    expect(
      getContextContentEstimate(content('data:image/png;base64,' + 'x'.repeat(500_000))),
    ).toEqual(getContextContentEstimate(content('https://owned.example/image.webp')));
    expect(getContextContentEstimate(content('https://owned.example/image.webp'))).toEqual({
      mediaTokens: 1000,
      text: 'describe this',
    });
  });
  it('counts text literally even when it happens to include a data URI', () => {
    expect(getContextContentEstimate('data:image/png;base64,abc').text).toBe(
      'data:image/png;base64,abc',
    );
  });
  it('counts serialized multimodal content without treating base64 as text', () => {
    expect(
      getContextContentEstimate(
        JSON.stringify([
          { type: 'text', text: 'hello' },
          { type: 'image', image: 'secret-binary' },
        ]),
        true,
      ),
    ).toEqual({ mediaTokens: 1000, text: 'hello' });
  });
  it('retains low detail and audio/video/file estimates without reading binary data', () => {
    expect(
      getContextContentEstimate([
        { type: 'image_url', image_url: { detail: 'low' } },
        { type: 'input_audio' },
        { type: 'video_url' },
        { type: 'file' },
      ]).mediaTokens,
    ).toBe(3085);
  });
});
