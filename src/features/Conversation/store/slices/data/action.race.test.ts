import type { ConversationContext, UIChatMessage } from '@lobechat/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useClientDataSWRWithSync } from '@/libs/swr';
import { messageService } from '@/services/message';

import type { Store } from '../../action';
import { dataSlice } from './action';

const { chat } = vi.hoisted(() => ({ chat: { dbMessagesMap: {}, replaceMessages: vi.fn() } }));
vi.mock('@/store/chat', () => ({ getChatStoreState: () => chat }));
vi.mock('@/store/chat/slices/operation/selectors', () => ({
  operationSelectors: {
    isAgentRuntimeRunningByContext: () => () => false,
    isMessageCreating: () => () => false,
  },
}));
vi.mock('@/libs/swr', () => ({ useClientDataSWRWithSync: vi.fn(() => ({})) }));
vi.mock('@/services/message', () => ({ messageService: { getMessages: vi.fn() } }));

const context: ConversationContext = { agentId: 'agent-a', topicId: 'topic-a', scope: 'main' };
const row = (id: string, content = id): UIChatMessage =>
  ({
    id,
    content,
    createdAt: 1,
    updatedAt: 1,
    role: 'user',
  }) as UIChatMessage;
const setup = () => {
  let state = {
    context,
    dbMessages: [],
    displayMessages: [],
    messageLoadingIds: [],
    onMessagesChange: vi.fn(),
  } as unknown as Store;
  const set = ((patch: Partial<Store>) => {
    state = { ...state, ...patch };
  }) as Parameters<typeof dataSlice>[0];
  const get = () => state;
  state = { ...state, ...dataSlice(set, get, {} as Parameters<typeof dataSlice>[2]) };
  state.useFetchMessages(context);
  const call = vi.mocked(useClientDataSWRWithSync).mock.calls.at(-1)!;
  return { get, set, fetch: call[1]!, onData: call[2]!.onData! };
};

beforeEach(() => {
  vi.clearAllMocks();
  chat.dbMessagesMap = {};
});

describe('conversation read races', () => {
  it('keeps a newly displayed message when an earlier empty read resolves', async () => {
    let resolve!: (rows: UIChatMessage[]) => void;
    vi.mocked(messageService.getMessages).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const f = setup();
    const reading = f.fetch();
    f.get().replaceMessages([row('new')]);
    resolve([]);
    f.onData(await reading, { source: 'network' });
    expect(f.get().dbMessages.map((m) => m.id)).toEqual(['new']);
  });

  it('ignores a response captured for the previous visible conversation', async () => {
    vi.mocked(messageService.getMessages).mockResolvedValue([row('old')]);
    const f = setup();
    const result = await f.fetch();
    f.set({ context: { ...context, topicId: 'topic-b' }, dbMessages: [row('current')] });
    f.onData(result, { source: 'network' });
    expect(f.get().dbMessages.map((m) => m.id)).toEqual(['current']);
  });

  it('does not overwrite an already displayed reply with persisted cache', () => {
    const f = setup();
    f.get().replaceMessages([row('reply', 'complete')]);
    f.onData([row('reply', 'partial')], { source: 'cache' });
    expect(f.get().dbMessages[0].content).toBe('complete');
  });

  it('routes a late mutation to its original bucket without replacing the visible conversation', () => {
    const f = setup();
    chat.dbMessagesMap = { 'main_agent-a_topic-a': [row('old')] };
    f.set({ context: { ...context, topicId: 'topic-b' }, dbMessages: [row('current')] });
    f.get().replaceMessages([row('saved')], context);
    expect(f.get().dbMessages.map((m) => m.id)).toEqual(['current']);
    expect(chat.replaceMessages).toHaveBeenCalledWith([row('saved')], { context });
  });
});
