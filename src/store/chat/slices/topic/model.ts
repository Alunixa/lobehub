import { useClientDataSWR } from '@/libs/swr';
import { topicService } from '@/services/topic';
import type { ChatStore } from '@/store/chat/store';
import type { StoreSetter } from '@/store/types';

import { topicSelectors } from './selectors';

export interface TopicModelSelection {
  model: string;
  provider: string;
}

/** Topic-owned config, adapted from upstream #15933 and #20968. */
export class TopicModelActionImpl {
  readonly #get: () => ChatStore;
  readonly #set: StoreSetter<ChatStore>;
  readonly #writes = new Map<string, Promise<void>>();
  readonly #reads = new Map<string, Promise<void>>();
  readonly #versions = new Map<string, number>();
  readonly #confirmed = new Map<string, { model?: string | null; provider?: string | null }>();

  constructor(set: StoreSetter<ChatStore>, get: () => ChatStore) {
    this.#set = set;
    this.#get = get;
  }

  setNewTopicModel = (agentId: string, selection: TopicModelSelection): void => {
    this.#set((s) => ({ newTopicModelMap: { ...s.newTopicModelMap, [agentId]: selection } }));
  };

  /** Seed a newly persisted topic, including isolated composers absent from the sidebar. */
  internal_seedTopicModel = (id: string, selection: TopicModelSelection): void => {
    if (this.#versions.has(id) || Object.hasOwn(this.#get().topicModelDetailMap, id)) return;
    this.#confirmed.set(id, selection);
    this.#set((s) => ({ topicModelDetailMap: { ...s.topicModelDetailMap, [id]: selection } }));
  };

  loadTopicModel = async (id: string): Promise<void> => {
    const pending = this.#reads.get(id);
    if (pending) return pending;
    const version = this.#versions.get(id);
    const read = (async () => {
      const topic = await topicService.getTopicDetail(id);
      if (!topic) throw new Error('Conversation not found');
      if (this.#writes.has(id) || version !== this.#versions.get(id)) return;
      this.#confirmed.set(id, { model: topic.model, provider: topic.provider });
      this.#set((s) => ({
        topicModelDetailMap: {
          ...s.topicModelDetailMap,
          [id]: { model: topic.model, provider: topic.provider },
        },
      }));
    })();
    this.#reads.set(id, read);
    try {
      await read;
    } finally {
      if (this.#reads.get(id) === read) this.#reads.delete(id);
    }
  };

  useFetchTopicModel = (id?: string | null) =>
    useClientDataSWR(
      id && !id.startsWith('tmp_topic_') ? ['topic-model', id] : null,
      () => this.loadTopicModel(id!),
      {
        dedupingInterval: 1000,
      },
    );

  ensureTopicModel = async (id: string): Promise<void> => {
    // A second selection can be queued while the first save is awaited.
    while (this.#writes.has(id)) await this.#writes.get(id);
    if (!Object.hasOwn(this.#get().topicModelDetailMap, id)) await this.loadTopicModel(id);
    while (this.#writes.has(id)) await this.#writes.get(id);
  };

  updateTopicModel = async (id: string, selection: TopicModelSelection): Promise<void> => {
    if (!selection.model || !selection.provider) throw new Error('Model and provider are required');
    if (!this.#confirmed.has(id)) {
      const known =
        this.#get().topicModelDetailMap[id] ?? topicSelectors.getTopicModelById(id)(this.#get());
      if (known) this.#confirmed.set(id, known);
    }
    const version = (this.#versions.get(id) ?? 0) + 1;
    this.#versions.set(id, version);
    this.#set((s) => ({
      topicModelDetailMap: { ...s.topicModelDetailMap, [id]: selection },
    }));

    // Serialize writes per topic: a slow earlier choice must not win in the DB.
    // Different topics remain independent; refetches begun before a write are discarded.
    const persist = async () => {
      try {
        // The user can select before the initial detail read finishes. Capture
        // the real rollback value instead of falling back to a shared Agent.
        if (!this.#confirmed.has(id)) {
          const topic = await topicService.getTopicDetail(id);
          if (!topic) throw new Error('Conversation not found');
          this.#confirmed.set(id, { model: topic.model, provider: topic.provider });
        }
        await topicService.updateTopic(id, selection);
        this.#confirmed.set(id, selection);
      } catch (error) {
        if (this.#versions.get(id) === version) {
          this.#set((s) => {
            const next = { ...s.topicModelDetailMap };
            const confirmed = this.#confirmed.get(id);
            if (confirmed) next[id] = confirmed;
            else delete next[id];
            return { topicModelDetailMap: next };
          });
        }
        throw error;
      } finally {
        if (this.#versions.get(id) === version) {
          this.#writes.delete(id);
        }
      }
    };
    const previous = this.#writes.get(id);
    const write = previous ? previous.then(persist, persist) : persist();
    this.#writes.set(id, write);
    await write;
  };
}

export type TopicModelAction = Pick<TopicModelActionImpl, keyof TopicModelActionImpl>;
