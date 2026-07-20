import { ModelProvider } from 'model-bank';
import { describe, expect, it } from 'vitest';

import {
  mergeInstructionsIntoSystemMessage,
  routeInstructions,
  supportsNativeInstructions,
} from './instructions';

describe('agent instructions routing', () => {
  it('uses native instructions for Responses API providers', () => {
    expect(
      supportsNativeInstructions({
        model: 'gpt-5.2',
        provider: ModelProvider.OpenAI,
      }),
    ).toBe(true);
    expect(
      supportsNativeInstructions({
        model: 'grok-4',
        provider: ModelProvider.XAI,
      }),
    ).toBe(true);
    expect(
      supportsNativeInstructions({
        enabledSearch: true,
        model: 'doubao-seed',
        provider: ModelProvider.Volcengine,
      }),
    ).toBe(true);
  });

  it('falls back to the system layer for providers without native instructions', () => {
    expect(
      supportsNativeInstructions({
        model: 'claude-sonnet-4-6',
        provider: ModelProvider.Anthropic,
      }),
    ).toBe(false);

    expect(
      mergeInstructionsIntoSystemMessage(
        [
          { content: 'Existing role', role: 'system' },
          { content: 'Hello', role: 'user' },
        ],
        'Advanced rule',
      ),
    ).toEqual([
      { content: 'Advanced rule\n\nExisting role', role: 'system' },
      { content: 'Hello', role: 'user' },
    ]);
  });

  it('creates a system message when the context has none', () => {
    expect(
      mergeInstructionsIntoSystemMessage([{ content: 'Hello', role: 'user' }], 'Advanced rule'),
    ).toEqual([
      { content: 'Advanced rule', role: 'system' },
      { content: 'Hello', role: 'user' },
    ]);
  });

  it('keeps instructions as a native field when a provider supports it', () => {
    expect(
      routeInstructions({
        instructions: 'Advanced rule',
        messages: [{ content: 'Hello', role: 'user' }],
        model: 'grok-4',
        provider: ModelProvider.XAI,
      }),
    ).toEqual({
      instructions: 'Advanced rule',
      messages: [{ content: 'Hello', role: 'user' }],
    });
  });

  it('moves instructions into the system layer for providers without a native field', () => {
    expect(
      routeInstructions({
        instructions: 'Advanced rule',
        messages: [{ content: 'Hello', role: 'user' }],
        model: 'claude-sonnet-4-6',
        provider: ModelProvider.Anthropic,
      }),
    ).toEqual({
      messages: [
        { content: 'Advanced rule', role: 'system' },
        { content: 'Hello', role: 'user' },
      ],
    });
  });
});
