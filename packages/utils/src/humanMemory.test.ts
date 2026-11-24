import { describe, expect, it } from 'vitest';

import { humanMemoryText, sanitizeHumanMemoryText } from './humanMemory';

describe('human memory text sanitization', () => {
  it('removes image transport data while retaining surrounding text', () => {
    const base64 = 'A'.repeat(160);
    const result = sanitizeHumanMemoryText(
      [
        '请记住我住在杭州。',
        '![generated](https://cdn.example.test/generated.png)',
        `data:image/png;base64,${base64}`,
        base64,
        'https://cdn.example.test/another.webp',
      ].join(' '),
    );

    expect(result).toBe('请记住我住在杭州。');
    expect(result).not.toContain('data:image');
    expect(result).not.toContain('https://');
    expect(result).not.toContain(base64);
  });

  it('keeps regular markdown link labels and ignores non-text content blocks', () => {
    expect(
      humanMemoryText([
        { type: 'text', text: '我喜欢 TypeScript。' },
        { type: 'image_url', image_url: { url: 'https://example.test/image.png' } },
        { type: 'text', text: '[项目文档](https://example.test/docs)' },
      ]),
    ).toBe('我喜欢 TypeScript。项目文档');
  });
});
