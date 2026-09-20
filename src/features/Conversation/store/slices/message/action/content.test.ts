import { afterEach, describe, expect, it, vi } from 'vitest';

import { messageService } from '@/services/message';

import { createStore } from '../../../index';

const create = () => createStore({ context: { agentId: 'agent', topicId: 'topic' } });
const original = {
  content: 'original',
  createdAt: 0,
  id: 'user',
  role: 'user' as const,
  updatedAt: 0,
};
const params = { content: 'edited', fileIds: ['image'], id: 'user' };
afterEach(() => vi.restoreAllMocks());

describe('message content mutations', () => {
  it('waits for persistence, updates attachments and never starts generation', async () => {
    const store = create();
    store.getState().replaceMessages([original]);
    const generate = vi.spyOn(store.getState(), 'regenerateUserMessage');
    vi.spyOn(messageService, 'editMessageContent').mockResolvedValue({
      messages: [
        {
          ...original,
          content: 'edited',
          imageList: [{ alt: 'image', id: 'image', url: '/image' }],
        },
      ],
      success: true,
    });
    await store.getState().saveMessageContent(params);
    expect(store.getState().dbMessages[0].imageList?.[0].id).toBe('image');
    expect(generate).not.toHaveBeenCalled();
  });
  it('keeps original content and propagates failures so the editor can retry', async () => {
    const store = create();
    store.getState().replaceMessages([original]);
    vi.spyOn(messageService, 'editMessageContent').mockRejectedValue(new Error('offline'));
    await expect(store.getState().saveMessageContent(params)).rejects.toThrow('offline');
    expect(store.getState().dbMessages[0].content).toBe('original');
  });
  it('does not report false success and blocks changes during generation', async () => {
    const store = create();
    const save = vi
      .spyOn(messageService, 'editMessageContent')
      .mockResolvedValue({ success: false });
    await expect(store.getState().saveMessageContent(params)).rejects.toThrow();
    store.setState({
      operationState: { ...store.getState().operationState, isInputLoading: true },
    });
    save.mockClear();
    await expect(store.getState().saveMessageContent(params)).rejects.toThrow('Wait');
    expect(save).not.toHaveBeenCalled();
  });
  it('does not overwrite another conversation after navigation while saving', async () => {
    const store = create();
    const sync = vi.fn();
    store.setState({ onMessagesChange: sync });
    vi.spyOn(messageService, 'editMessageContent').mockImplementation(async () => {
      store.setState({ context: { agentId: 'agent', topicId: 'other' } });
      return { messages: [{ ...original, content: 'edited' }], success: true };
    });
    await store.getState().saveMessageContent(params);
    expect(store.getState().dbMessages).toEqual([]);
    expect(sync).toHaveBeenCalledWith(expect.any(Array), { agentId: 'agent', topicId: 'topic' });
  });
});
