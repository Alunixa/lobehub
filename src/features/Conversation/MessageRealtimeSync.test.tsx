/**
 * @vitest-environment happy-dom
 */
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MessageRealtimeSync from './MessageRealtimeSync';

const mocks = vi.hoisted(() => ({
  callbacks: undefined as
    | { onReconnect: () => void; onUpdate: () => void }
    | undefined,
  dispose: vi.fn(),
  mutate: vi.fn(),
  streaming: false,
  subscribe: vi.fn(),
}));

vi.mock('@/libs/swr', () => ({ mutate: mocks.mutate }));
vi.mock('@/services/realtime/messageSubscription', () => ({
  subscribeToMessageUpdates: mocks.subscribe,
}));
vi.mock('@/store/chat', () => ({
  getChatStoreState: () => ({}),
  useChatStore: (selector: (state: unknown) => unknown) => selector({}),
}));
vi.mock('@/store/chat/selectors', () => ({
  operationSelectors: {
    isAgentRuntimeRunningByContext: () => () => mocks.streaming,
  },
}));

describe('MessageRealtimeSync', () => {
  beforeEach(() => {
    mocks.callbacks = undefined;
    mocks.dispose.mockReset();
    mocks.mutate.mockReset();
    mocks.streaming = false;
    mocks.subscribe.mockReset();
    mocks.subscribe.mockImplementation((_context, callbacks) => {
      mocks.callbacks = callbacks;
      return mocks.dispose;
    });
  });

  it('revalidates the exact conversation and defers invalidations while streaming', () => {
    const context = { agentId: 'agent-1', topicId: 'topic-1' };
    const view = render(<MessageRealtimeSync context={context} />);

    expect(mocks.subscribe).toHaveBeenCalledWith(context, expect.any(Object));
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
    act(() => mocks.callbacks!.onUpdate());
    expect(mocks.mutate).toHaveBeenLastCalledWith(['message:list', context, 1]);

    mocks.streaming = true;
    view.rerender(<MessageRealtimeSync context={{ ...context }} />);
    expect(mocks.dispose).not.toHaveBeenCalled();
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
    act(() => mocks.callbacks!.onUpdate());
    expect(mocks.mutate).toHaveBeenCalledTimes(1);

    mocks.streaming = false;
    view.rerender(<MessageRealtimeSync context={{ ...context }} />);
    expect(mocks.dispose).not.toHaveBeenCalled();
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
    expect(mocks.mutate).toHaveBeenCalledTimes(2);
  });

  it('replaces the subscription when the conversation coordinates change', () => {
    const view = render(
      <MessageRealtimeSync context={{ agentId: 'agent-1', topicId: 'topic-1' }} />,
    );

    view.rerender(<MessageRealtimeSync context={{ agentId: 'agent-1', topicId: 'topic-2' }} />);

    expect(mocks.dispose).toHaveBeenCalledTimes(1);
    expect(mocks.subscribe).toHaveBeenCalledTimes(2);
    expect(mocks.subscribe).toHaveBeenLastCalledWith(
      { agentId: 'agent-1', topicId: 'topic-2' },
      expect.any(Object),
    );
  });
});
