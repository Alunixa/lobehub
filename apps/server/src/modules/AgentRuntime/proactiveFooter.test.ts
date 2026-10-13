import { describe, expect, it } from 'vitest';

import { PROACTIVE_OPEN, ProactiveFooterStream } from './proactiveFooter';

describe('private autonomous scheduling footer', () => {
  it('never leaks private tags or JSON when split at every character', () => {
    const parser = new ProactiveFooterStream();
    let visible = '';
    for (const character of `Normal answer.${PROACTIVE_OPEN}{"idleForSeconds":731}</lobe_proactive_plan>`)
      visible += parser.append(character);
    const end = parser.finish();
    visible += end.visibleTail;
    expect(visible).toBe('Normal answer.');
    expect(end.decision?.idleForSeconds).toBe(731);
  });
  it('preserves normal angle brackets and ordinary streamed text', () => {
    const parser = new ProactiveFooterStream();
    expect(parser.append('a < b; normal text')).toBe('a < b; normal text');
    expect(parser.finish().decision).toBeUndefined();
  });
  it('allows an explicit decision not to speak or schedule', () => {
    const parser = new ProactiveFooterStream();
    expect(parser.append(`${PROACTIVE_OPEN}null</lobe_proactive_plan>`)).toBe('');
    expect(parser.finish()).toMatchObject({ declined: true, visibleTail: '' });
  });
  it.each([
    '{"idleForSeconds":0}',
    '{"idleForSeconds":-1}',
    '{"idleForSeconds":60,"sendAt":"2026-10-14T10:00:00Z"}',
    '{invalid}',
  ])('hides invalid control data without scheduling: %s', (json) => {
    const parser = new ProactiveFooterStream();
    expect(parser.append(`answer${PROACTIVE_OPEN}${json}</lobe_proactive_plan>`)).toBe('answer');
    expect(parser.finish().decision).toBeUndefined();
  });
  it('does not treat an unterminated or oversized footer as a valid schedule', () => {
    const parser = new ProactiveFooterStream();
    parser.append(`answer${PROACTIVE_OPEN}${'x'.repeat(10000)}`);
    expect(parser.finish()).toEqual({ visibleTail: '' });
  });
});
