import { describe, expect, it } from 'vitest';

import type { ContextWindowMessage } from '@/features/ChatInput/store/initialState';

import {
  getContextCapacity,
  getContextTextEstimateInput,
  getRecordedContextUsage,
} from './contextUsage';

const answer = (
  inputTokens: number,
  extra?: Partial<ContextWindowMessage>,
): ContextWindowMessage => ({
  content: 'answer',
  model: 'model-1',
  provider: 'provider-1',
  role: 'assistant',
  usage: { inputCachedTokens: 80, totalInputTokens: inputTokens },
  ...extra,
});

describe('context window usage semantics', () => {
  it('uses the latest single request total, including cached input, rather than summing turns', () => {
    expect(getRecordedContextUsage([answer(100), answer(300)], 'model-1', 'provider-1')).toEqual({
      cachedTokens: 80,
      inputTokens: 300,
    });
  });

  it('does not reuse input totals from a different model or provider', () => {
    expect(
      getRecordedContextUsage(
        [answer(100), answer(800, { model: 'other' }), answer(900, { provider: 'other' })],
        'model-1',
        'provider-1',
      ),
    ).toMatchObject({ inputTokens: 100 });
  });

  it('keeps legacy recorded usage and ignores malformed measurements', () => {
    const legacy = answer(100, {
      metadata: { usage: { totalInputTokens: 512_000 } },
      usage: undefined,
    });
    expect(
      getRecordedContextUsage(
        [legacy, answer(Number.NaN), answer(Number.POSITIVE_INFINITY)],
        'model-1',
        'provider-1',
      ),
    ).toMatchObject({ inputTokens: 512_000 });
    expect(getRecordedContextUsage([], 'model-1', 'provider-1')).toBeUndefined();
  });

  it('never returns negative remaining capacity or changes the configured window', () => {
    expect(getContextCapacity(512_000, 128_000)).toEqual({
      maximum: 128_000,
      remaining: 0,
      used: 512_000,
    });
    expect(getContextCapacity(Number.NaN, Number.NaN)).toEqual({
      maximum: 0,
      remaining: 0,
      used: 0,
    });
  });

  it('counts tool request text and retained signatures without echoing internal tool state', () => {
    const messages: ContextWindowMessage[] = [
      {
        content: '...',
        reasoning: { content: 'private thinking' },
        role: 'assistant',
        tools: [
          {
            apiName: 'lookup',
            arguments: '{"query":"scene"}',
            id: 'call-1',
            identifier: 'provider-tool',
            thoughtSignature: 'retained-signature',
            type: 'builtin',
          },
        ],
      },
    ];
    const text = getContextTextEstimateInput(messages, false);
    expect(text).toContain('lookup');
    expect(text).toContain('retained-signature');
    expect(text).not.toContain('private thinking');
    expect(text).not.toContain('provider-tool');
    expect(getContextTextEstimateInput(messages, true)).toContain('private thinking');
  });

  it('preserves a literal user ellipsis but excludes an assistant loading placeholder', () => {
    expect(
      getContextTextEstimateInput(
        [
          { content: '...', role: 'user' },
          { content: '...', role: 'assistant' },
        ],
        false,
      ).trim(),
    ).toBe('...');
  });
});
