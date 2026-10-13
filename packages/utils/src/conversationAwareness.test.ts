import { describe, expect, it } from 'vitest';

import { appendConversationAwareness } from './conversationAwareness';

describe('model-only conversation awareness', () => {
  const user = {
    role: 'user',
    content: 'hello',
    metadata: {
      awareness: {
        composedForMs: 12400,
        sentAt: '2026-10-13T10:00:00.000Z',
      },
    },
  };

  it('is disabled by default and keeps display objects intact', () => {
    expect(appendConversationAwareness([user], {})).toEqual([user]);
    expect(user.content).toBe('hello');
  });
  it('adds only the selected fields to a copy', () => {
    const [result] = appendConversationAwareness([user], { typingAwareness: true });
    expect(result.content).toContain('composed_ms=12400');
    expect(result.content).not.toContain('sent_at=');
    expect(user.content).toBe('hello');
  });
  it('adds an input timestamp independently', () => {
    const [result] = appendConversationAwareness([user], { inputTimestamps: true });
    expect(result.content).toContain('sent_at=2026-10-13T10:00:00.000Z');
    expect(result.content).not.toContain('composed_ms=');
  });
  it('retains every multimodal part and puts the tiny context last', () => {
    const parts = [{ type: 'image_url', image_url: { url: 'data:image/png;base64,fixture' } }];
    const [result] = appendConversationAwareness([{ ...user, content: parts }], {
      typingAwareness: true,
    });
    expect(result.content[0]).toEqual(parts[0]);
    expect(result.content).toHaveLength(2);
    expect(parts).toHaveLength(1);
  });
  it('annotates completion time without claiming pure reasoning duration', () => {
    const [result] = appendConversationAwareness(
      [
        {
          role: 'assistant',
          content: 'answer',
          metadata: {
            awareness: { outputFinishedAt: '2026-10-13T10:00:42.000Z', responseElapsedMs: 42000 },
          },
        },
      ],
      { outputTimestamps: true },
    );
    expect(result.content).toContain('output_finished_at=2026-10-13T10:00:42.000Z');
    expect(result.content).toContain('includes tools/network');
  });
  it('handles missing content and ignores invalid timestamps', () => {
    expect(
      appendConversationAwareness([{ ...user, content: null }], { typingAwareness: true })[0]
        .content,
    ).toContain('composed_ms=');
    expect(
      appendConversationAwareness(
        [
          {
            ...user,
            metadata: { awareness: { sentAt: 'not a date' } },
          },
        ],
        { inputTimestamps: true },
      )[0].content,
    ).toBe('hello');
  });
});
