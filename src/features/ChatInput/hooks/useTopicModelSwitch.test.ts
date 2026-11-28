import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTopicModelSwitch } from './useTopicModelSwitch';

const fixture = vi.hoisted(() => ({
  persistNewTopicModel: true,
  topicId: null as string | null,
  save: vi.fn().mockResolvedValue(undefined),
  draft: vi.fn(),
  updateTopicModel: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/components/AntdStaticMethods', () => ({ message: { error: vi.fn() } }));
vi.mock('@/store/agent', () => ({
  useAgentStore: (select: (s: unknown) => unknown) =>
    select({ updateAgentConfigById: fixture.save }),
}));
vi.mock('@/store/chat', () => ({
  useChatStore: (select: (s: unknown) => unknown) =>
    select({ updateTopicModel: fixture.updateTopicModel, setNewTopicModel: fixture.draft }),
}));
vi.mock('../store', () => ({
  useChatInputStore: (select: (s: unknown) => unknown) => select(fixture),
}));
vi.mock('./useAgentId', () => ({ useAgentId: () => 'home-agent' }));
vi.mock('./useTopicId', () => ({ useTopicId: () => fixture.topicId }));
vi.mock('./useEffectiveModel', () => ({
  useEffectiveModel: () => ({ model: 'old', provider: 'custom' }),
}));

describe('home model persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.persistNewTopicModel = true;
    fixture.topicId = null;
  });
  it('persists the home composer selection for reloads', async () => {
    const { result } = renderHook(() => useTopicModelSwitch());
    const value = { model: 'available', provider: 'custom' };
    await act(async () => {
      await result.current.switchModel(value);
    });
    expect(fixture.save).toHaveBeenCalledWith('home-agent', value);
    expect(fixture.draft).toHaveBeenCalledWith('home-agent', value);
  });
  it('keeps existing topics independent of the agent default', async () => {
    fixture.topicId = 'existing-topic';
    const { result } = renderHook(() => useTopicModelSwitch());
    const value = { model: 'available', provider: 'custom' };
    await act(async () => {
      await result.current.switchModel(value);
    });
    expect(fixture.updateTopicModel).toHaveBeenCalledWith('existing-topic', value);
    expect(fixture.save).not.toHaveBeenCalled();
  });
});
