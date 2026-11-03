import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEffectiveModel } from './useEffectiveModel';

const fixture = vi.hoisted(() => ({
  context: undefined as { topicId?: string | null } | undefined,
  state: {
    activeAgentId: 'agent-a',
    activeTopicId: 'topic-a' as string | null,
    newTopicModelMap: {} as Record<string, { model: string; provider: string }>,
    topicModelDetailMap: {} as Record<string, { model: string; provider: string }>,
    topicDataMap: {},
    useFetchTopicModel: vi.fn(),
    setNewTopicModel: vi.fn(),
  },
}));

vi.mock('@/store/agent', () => ({
  useAgentStore: (selector: (s: unknown) => unknown) => selector({}),
}));
vi.mock('@/store/agent/selectors', () => ({
  agentByIdSelectors: {
    getAgentModelById: () => () => 'agent-default',
    getAgentModelProviderById: () => () => 'agent-provider',
  },
}));
vi.mock('@/store/chat', () => ({
  useChatStore: Object.assign(
    (selector: (s: typeof fixture.state) => unknown) => selector(fixture.state),
    {
      getState: () => fixture.state,
    },
  ),
}));
vi.mock('../store', () => ({
  useChatInputStore: (selector: (s: unknown) => unknown) =>
    selector({ conversationContext: fixture.context }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  fixture.context = undefined;
  fixture.state.activeTopicId = 'topic-a';
  fixture.state.topicModelDetailMap = {
    'topic-a': { model: 'a', provider: 'provider-a' },
    'topic-b': { model: 'b', provider: 'provider-b' },
  };
  fixture.state.newTopicModelMap = { 'agent-a': { model: 'draft', provider: 'draft-provider' } };
});

describe('effective input model', () => {
  it('uses the addressed embedded topic rather than the outer active topic', () => {
    fixture.context = { topicId: 'topic-b' };
    const { result } = renderHook(() => useEffectiveModel('agent-a'));
    expect(result.current).toEqual({ model: 'b', provider: 'provider-b' });
    expect(fixture.state.setNewTopicModel).not.toHaveBeenCalled();
  });

  it('keeps explicit null topic isolated and uses its draft model', () => {
    fixture.context = { topicId: null };
    const { result } = renderHook(() => useEffectiveModel('agent-a'));
    expect(result.current).toEqual({ model: 'draft', provider: 'draft-provider' });
    expect(fixture.state.useFetchTopicModel).toHaveBeenCalledWith(null);
  });

  it('remembers the active model for new chats opened through direct navigation', () => {
    const { result } = renderHook(() => useEffectiveModel('agent-a'));
    expect(result.current).toEqual({ model: 'a', provider: 'provider-a' });
    expect(fixture.state.setNewTopicModel).toHaveBeenCalledWith('agent-a', result.current);
  });

  it('resolves model and provider together after switching conversations', () => {
    const { result, rerender } = renderHook(() => useEffectiveModel('agent-a'));
    fixture.state.activeTopicId = 'topic-b';
    rerender();
    expect(result.current).toEqual({ model: 'b', provider: 'provider-b' });
  });
});
