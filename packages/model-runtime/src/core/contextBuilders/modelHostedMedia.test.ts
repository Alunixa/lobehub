import { describe, expect, it } from 'vitest';

import { isModelHostedMedia, registerModelHostedMedia } from './modelHostedMedia';

describe('server-scoped hosted image identity', () => {
  it('recognizes only the exact registered object and URL', () => {
    const media = registerModelHostedMedia({ url: 'https://media.example/signed', detail: 'high' });
    expect(isModelHostedMedia(media)).toBe(true);
    expect(isModelHostedMedia({ ...media })).toBe(false);
    const serialized = JSON.stringify(media);
    expect(isModelHostedMedia(JSON.parse(serialized))).toBe(false);
    expect(serialized).toBe('{"url":"https://media.example/signed","detail":"high"}');
    media.url = 'https://untrusted.example/image';
    expect(isModelHostedMedia(media)).toBe(false);
  });
  it('does not accept a caller-supplied marker or a missing URL', () => {
    expect(isModelHostedMedia({ url: 'https://example.com/image', hosted: true } as never)).toBe(
      false,
    );
    expect(isModelHostedMedia({} as never)).toBe(false);
  });
});
