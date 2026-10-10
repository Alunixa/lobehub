import type { UIChatMessage } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import { formatErrorEventData } from '@/server/modules/AgentRuntime/formatErrorEventData';
import { formatErrorForState } from '@/server/modules/AgentRuntime/formatErrorForState';
import { prepareInferenceMessages } from '@/server/modules/AgentRuntime/inferenceMessages';
import { createProviderConfigHook } from '@/server/modules/ModelRuntime/providerConfigHook';

import { isEmptyModelCompletion } from '../../packages/model-runtime/src/errors/modelEmptyCompletion';
import type { ChatStreamPayload } from '../../packages/model-runtime/src/types';

const rows = (messages: Array<Partial<UIChatMessage>>) => messages as UIChatMessage[];

describe('inference history is not a UI snapshot', () => {
  it('keeps the user turn last instead of sending the generating placeholder as assistant prefill', () => {
    const input = rows([
      { id: 'history-user', role: 'user', content: 'old' },
      { id: 'history-answer', role: 'assistant', content: 'answer' },
      { id: 'user', role: 'user', content: '晚上好' },
      { id: 'pending', role: 'assistant', content: '...' },
    ]);
    const prepared = prepareInferenceMessages(input, 'pending');
    expect(prepared.map((m) => m.id)).toEqual(['history-user', 'history-answer', 'user']);
    expect(prepared.at(-1)).toMatchObject({ role: 'user', content: '晚上好' });
    expect(input.at(-1)?.content).toBe('...');
  });

  it('removes failed loading placeholders but retains authored ellipses and partial answers', () => {
    const input = rows([
      { id: 'failed', role: 'assistant', content: '...', error: { type: 'ProviderBizError' } },
      { id: 'real-ellipsis', role: 'assistant', content: '...' },
      { id: 'literal-user', role: 'user', content: '...' },
      {
        id: 'partial',
        role: 'assistant',
        content: 'partial answer',
        error: { type: 'ProviderBizError' },
      },
    ]);
    expect(prepareInferenceMessages(input).map((m) => m.id)).toEqual([
      'real-ellipsis',
      'literal-user',
      'partial',
    ]);
  });

  it('removes the current placeholder inside a grouped message without losing prior tool steps', () => {
    const group = {
      id: 'group',
      role: 'assistantGroup',
      content: '',
      children: rows([
        { id: 'step', role: 'assistant', content: 'tool analysis' },
        { id: 'pending', role: 'assistant', content: '...' },
      ]),
    } as unknown as UIChatMessage;
    const result = prepareInferenceMessages([group], 'pending');
    expect('children' in result[0] && result[0].children?.map((m) => m.id)).toEqual(['step']);
  });

  it('preserves the full 86-image history instead of trimming it for speed', () => {
    const input = rows(
      Array.from({ length: 86 }, (_, i) => ({
        id: `image-${i}`,
        role: 'user',
        content: `frame ${i}`,
        imageList: [{ id: `file_${i}`, url: `/f/file_${i}` }] as UIChatMessage['imageList'],
      })),
    );
    expect(prepareInferenceMessages(input)).toEqual(input);
  });
});

describe('server requests honor provider API settings', () => {
  it.each([true, false])('keeps explicit Responses API mode %s', async (enabled) => {
    const payload: ChatStreamPayload = { model: 'custom', messages: [] };
    await createProviderConfigHook('openai', enabled).beforeChat!(payload);
    expect(payload.apiMode).toBe(enabled ? 'responses' : 'chatCompletion');
  });

  it('does not inject OpenAI API mode into the native Anthropic protocol', async () => {
    const payload: ChatStreamPayload = { model: 'claude', messages: [] };
    await createProviderConfigHook('anthropic', true).beforeChat!(payload);
    expect(payload.apiMode).toBeUndefined();
  });
});

describe('no visible answer is not a successful completion', () => {
  it.each([0, 1, 34, 688])(
    'does not excuse an empty answer because %d tokens were billed',
    (outputTokens) => {
      expect(
        isEmptyModelCompletion({
          content: '',
          imageCount: 0,
          outputTokens,
          reasoning: '',
          toolCallCount: 0,
        }),
      ).toBe(true);
    },
  );

  it('reports thinking-only completion instead of showing a silent empty answer', () => {
    expect(
      isEmptyModelCompletion({
        content: '',
        imageCount: 0,
        outputTokens: 65536,
        reasoning: 'still thinking',
        toolCallCount: 0,
      }),
    ).toBe(true);
  });

  it.each([
    { content: 'answer', imageCount: 0, toolCallCount: 0 },
    {
      content: '',
      imageCount: 1,
      toolCallCount: 0,
    },
    { content: '', imageCount: 0, toolCallCount: 1 },
  ])('accepts visible output or tool calls: %j', (result) => {
    expect(isEmptyModelCompletion({ ...result, outputTokens: 0, reasoning: '' })).toBe(false);
  });
});

describe('structured errors survive both persistence and SSE', () => {
  it('preserves request failed without reclassifying it as a policy violation', () => {
    const error = Object.assign(new Error('request failed'), {
      errorType: 'ProviderBizError',
      _responseBody: {
        error: { type: 'upstream_error', message: 'request failed' },
        status: 502,
        provider: 'claude',
      },
    });
    const state = formatErrorForState(error);
    const event = formatErrorEventData(error, 'llm_execution');
    expect(state.type).not.toBe('ProviderContentPolicyViolation');
    expect(event.body).toMatchObject({
      error: { type: 'upstream_error', message: 'request failed' },
      status: 502,
    });
    expect(event.error).toBe('request failed');
  });

  it('keeps a real content_filter flag and source frame rather than deleting the diagnostics', () => {
    const body = { finishReason: 'content_filter', model: 'claude-opus-5-5', provider: 'openai' };
    const error = Object.assign(new Error('Provider returned content_filter'), {
      errorType: 'ProviderContentPolicyViolation',
      _responseBody: body,
    });
    expect(formatErrorForState(error)).toMatchObject({
      type: 'ProviderContentPolicyViolation',
      body,
    });
    expect(formatErrorEventData(error, 'llm_execution')).toMatchObject({
      errorType: 'ProviderContentPolicyViolation',
      body,
    });
  });
});
