import { beforeEach, describe, expect, it, vi } from 'vitest';

import { topicService } from '@/services/topic';
import type { ChatStore } from '@/store/chat/store';
import type { StoreSetter } from '@/store/types';

import { TopicModelActionImpl } from './model';

vi.mock('@/libs/swr', () => ({ useClientDataSWR: vi.fn() }));
vi.mock('@/services/topic', () => ({
  topicService: { getTopicDetail: vi.fn(), updateTopic: vi.fn() },
}));

const a = { model: 'model-a', provider: 'provider-a' };
const b = { model: 'model-b', provider: 'provider-b' };
const c = { model: 'model-c', provider: 'provider-c' };
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const fixture = () => {
  let state = { newTopicModelMap: {}, topicModelDetailMap: {}, topicDataMap: {} } as ChatStore;
  const set = ((update: Partial<ChatStore> | ((s: ChatStore) => Partial<ChatStore>)) => {
    state = { ...state, ...(typeof update === 'function' ? update(state) : update) };
  }) as StoreSetter<ChatStore>;
  return { action: new TopicModelActionImpl(set, () => state), state: () => state };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('topic-owned model persistence', () => {
  it('changes only the addressed topic and leaves other topics/drafts unchanged', async () => {
    const f = fixture();
    f.action.setNewTopicModel('agent-a', a);
    vi.mocked(topicService.getTopicDetail).mockImplementation(
      async (id) => ({ id, ...(id === 'a' ? b : c) }) as never,
    );
    await f.action.loadTopicModel('b');
    await f.action.updateTopicModel('a', b);
    expect(f.state().topicModelDetailMap).toEqual({ a: b, b: c });
    expect(f.state().newTopicModelMap).toEqual({ 'agent-a': a });
    expect(topicService.updateTopic).toHaveBeenCalledWith('a', b);
  });

  it('serializes rapid choices so a delayed earlier write cannot win', async () => {
    const f = fixture();
    const first = deferred<never>();
    let saved = a;
    vi.mocked(topicService.updateTopic)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(async (_, value) => {
        saved = value as typeof a;
        return [] as never;
      });
    vi.mocked(topicService.getTopicDetail).mockImplementation(async () => saved as never);
    await f.action.loadTopicModel('a');
    const one = f.action.updateTopicModel('a', b);
    const two = f.action.updateTopicModel('a', c);
    expect(topicService.updateTopic).toHaveBeenCalledTimes(1);
    expect(f.state().topicModelDetailMap.a).toEqual(c);
    first.resolve([] as never);
    await Promise.all([one, two]);
    expect(saved).toEqual(c);
    expect(f.state().topicModelDetailMap.a).toEqual(c);
  });

  it('rolls a failed model save back to the persisted selection', async () => {
    const f = fixture();
    vi.mocked(topicService.getTopicDetail).mockResolvedValue(a as never);
    await f.action.loadTopicModel('a');
    vi.mocked(topicService.updateTopic).mockRejectedValue(new Error('offline'));
    await expect(f.action.updateTopicModel('a', b)).rejects.toThrow('offline');
    expect(f.state().topicModelDetailMap.a).toEqual(a);
  });

  it('ignores an old topic read that resolves after switching models', async () => {
    const f = fixture();
    const old = deferred<never>();
    vi.mocked(topicService.getTopicDetail)
      .mockImplementationOnce(() => old.promise)
      .mockResolvedValue(b as never);
    const reading = f.action.loadTopicModel('a');
    await f.action.updateTopicModel('a', b);
    old.resolve(a as never);
    await reading;
    expect(f.state().topicModelDetailMap.a).toEqual(b);
  });

  it('loads an unlisted topic before executing and retains explicit legacy nulls', async () => {
    const f = fixture();
    vi.mocked(topicService.getTopicDetail).mockResolvedValue({
      model: null,
      provider: null,
    } as never);
    await f.action.ensureTopicModel('unlisted');
    await f.action.ensureTopicModel('unlisted');
    expect(topicService.getTopicDetail).toHaveBeenCalledTimes(1);
    expect(f.state().topicModelDetailMap.unlisted).toEqual({ model: null, provider: null });
  });

  it('waits for a second model save queued while send awaits the first', async () => {
    const f = fixture();
    f.action.internal_seedTopicModel('a', a);
    const first = deferred<never>();
    const second = deferred<never>();
    vi.mocked(topicService.updateTopic)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const one = f.action.updateTopicModel('a', b);
    let ready = false;
    const sending = f.action.ensureTopicModel('a').then(() => {
      ready = true;
    });
    const two = f.action.updateTopicModel('a', c);
    first.resolve([] as never);
    await one;
    await Promise.resolve();
    expect(ready).toBe(false);
    second.resolve([] as never);
    await Promise.all([two, sending]);
    expect(ready).toBe(true);
    expect(f.state().topicModelDetailMap.a).toEqual(c);
  });

  it('restores the persisted model when selection happens before hydration', async () => {
    const f = fixture();
    vi.mocked(topicService.getTopicDetail).mockResolvedValue(a as never);
    vi.mocked(topicService.updateTopic).mockRejectedValue(new Error('offline'));
    await expect(f.action.updateTopicModel('a', b)).rejects.toThrow('offline');
    expect(f.state().topicModelDetailMap.a).toEqual(a);
  });

  it('does not cache a missing rollback value after a failed detail read', async () => {
    const f = fixture();
    vi.mocked(topicService.getTopicDetail)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(a as never);
    await expect(f.action.updateTopicModel('a', b)).rejects.toThrow('offline');
    expect(f.state().topicModelDetailMap.a).toBeUndefined();
    await f.action.ensureTopicModel('a');
    expect(f.state().topicModelDetailMap.a).toEqual(a);
  });

  it('deduplicates concurrent detail reads for one topic', async () => {
    const f = fixture();
    vi.mocked(topicService.getTopicDetail).mockResolvedValue(a as never);
    await Promise.all([f.action.ensureTopicModel('a'), f.action.ensureTopicModel('a')]);
    expect(topicService.getTopicDetail).toHaveBeenCalledTimes(1);
  });
});
