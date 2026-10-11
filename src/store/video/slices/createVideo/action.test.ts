import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { videoService } from '@/services/video';
import type { StoreSetter } from '@/store/types';
import type { VideoStore } from '@/store/video/store';
import { AsyncTaskStatus } from '@/types/asyncTask';

import { CreateVideoActionImpl } from './action';

vi.mock('@/components/AntdStaticMethods', () => ({ message: { warning: vi.fn() } }));
vi.mock('@/business/client/handleGenerationPromptModerationError', () => ({
  handleGenerationPromptModerationError: vi.fn(),
}));
vi.mock('@/business/client/handleLobeHubModelDeprecatedError', () => ({
  handleLobeHubModelDeprecatedError: vi.fn(),
}));

const accepted = {
  success: true,
  data: {
    batch: {
      id: 'batch-new',
      model: 'veo-test',
      provider: 'google',
      prompt: 'a moving scene',
      config: {},
    },
    generations: [{ id: 'gen-new', asyncTaskId: 'task-new' }],
  },
} as Awaited<ReturnType<typeof videoService.createVideo>>;

const setup = (existingTopic: string | null = null) => {
  const state = {
    activeGenerationTopicId: existingTopic,
    createGenerationTopic: vi.fn().mockResolvedValue('topic-new'),
    generationBatchesMap: {},
    internal_dispatchGenerationBatch: vi.fn(),
    isCreating: false,
    isCreatingWithNewTopic: false,
    model: 'veo-test',
    parameters: { prompt: 'a moving scene' },
    parametersSchema: {},
    provider: 'google',
    refreshGenerationBatches: vi.fn().mockResolvedValue(undefined),
    removeGenerationBatch: vi.fn(),
    setTopicBatchLoaded: vi.fn(),
    switchGenerationTopic: vi.fn((id: string) => {
      state.activeGenerationTopicId = id;
    }),
  } as unknown as VideoStore;
  const setter: StoreSetter<VideoStore> = (update) => {
    Object.assign(state, typeof update === 'function' ? update(state) : update);
  };
  return { state, action: new CreateVideoActionImpl(setter, () => state) };
};
beforeEach(() => {
  vi.spyOn(videoService, 'createVideo').mockResolvedValue(accepted);
});
afterEach(() => vi.restoreAllMocks());

describe('video submission owns its lifecycle without a sidebar', () => {
  it('immediately publishes the accepted first task and refreshes its explicit topic', async () => {
    const { state, action } = setup();
    await action.createVideo();
    expect(state.internal_dispatchGenerationBatch).toHaveBeenCalledWith('topic-new', {
      type: 'addBatch',
      value: expect.objectContaining({
        id: 'batch-new',
        generations: [
          expect.objectContaining({
            id: 'gen-new',
            task: { id: 'task-new', status: AsyncTaskStatus.Pending },
          }),
        ],
      }),
    });
    expect(state.refreshGenerationBatches).toHaveBeenCalledWith('topic-new');
    expect(state.isCreating).toBe(false);
  });
  it('resets busy state when validation fails before any request', async () => {
    const { state, action } = setup();
    state.parameters.prompt = '  ';
    await expect(action.createVideo()).rejects.toThrow('prompt is empty');
    expect(state.isCreating).toBe(false);
    expect(videoService.createVideo).not.toHaveBeenCalled();
  });
  it('resets busy state and preserves the draft when topic creation fails', async () => {
    const { state, action } = setup();
    vi.mocked(state.createGenerationTopic).mockRejectedValueOnce(new Error('offline'));
    await expect(action.createVideo()).rejects.toThrow('offline');
    expect(state.isCreating).toBe(false);
    expect(state.isCreatingWithNewTopic).toBe(false);
    expect(state.parameters.prompt).toBe('a moving scene');
  });
  it('does not treat a failed follow-up GET as a failed billable POST', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { state, action } = setup();
    vi.mocked(state.refreshGenerationBatches).mockRejectedValueOnce(new Error('refresh offline'));
    await expect(action.createVideo()).resolves.toBeUndefined();
    expect(videoService.createVideo).toHaveBeenCalledTimes(1);
    expect(state.internal_dispatchGenerationBatch).toHaveBeenCalled();
  });
  it('prevents duplicate taps while the submission is in flight', async () => {
    const pending = Promise.withResolvers<typeof accepted>();
    vi.mocked(videoService.createVideo).mockReturnValueOnce(pending.promise);
    const { action } = setup('topic-existing');
    const first = action.createVideo();
    await action.createVideo();
    expect(videoService.createVideo).toHaveBeenCalledTimes(1);
    pending.resolve(accepted);
    await first;
  });
  it('does not erase a newer draft edited during submission', async () => {
    const pending = Promise.withResolvers<typeof accepted>();
    vi.mocked(videoService.createVideo).mockReturnValueOnce(pending.promise);
    const { state, action } = setup('topic-existing');
    const first = action.createVideo();
    state.parameters = { ...state.parameters, prompt: 'newer idea' };
    pending.resolve(accepted);
    await first;
    expect(state.parameters.prompt).toBe('newer idea');
  });
  it('keeps the original batch when regenerating', async () => {
    const { state, action } = setup('topic-existing');
    state.generationBatchesMap['topic-existing'] = [
      {
        ...accepted.data!.batch,
        id: 'batch-original',
        generations: [],
      } as never,
    ];
    await action.recreateVideo('batch-original');
    expect(state.removeGenerationBatch).not.toHaveBeenCalled();
    expect(state.internal_dispatchGenerationBatch).toHaveBeenCalled();
    expect(state.generationBatchesMap['topic-existing']).toHaveLength(1);
  });
});
