import { t } from 'i18next';
import type { RuntimeVideoGenParams } from 'model-bank';

import { handleGenerationPromptModerationError } from '@/business/client/handleGenerationPromptModerationError';
import { handleLobeHubModelDeprecatedError } from '@/business/client/handleLobeHubModelDeprecatedError';
import { message } from '@/components/AntdStaticMethods';
import { videoService } from '@/services/video';
import { type StoreSetter } from '@/store/types';
import { AsyncTaskStatus } from '@/types/asyncTask';
import type { GenerationConfig } from '@/types/generation';

import { type VideoStore } from '../../store';
import { generationBatchSelectors } from '../generationBatch/selectors';
import { videoGenerationConfigSelectors } from '../generationConfig/selectors';
import { generationTopicSelectors } from '../generationTopic';

type Setter = StoreSetter<VideoStore>;

const publishAcceptedVideoTasks = (
  store: VideoStore,
  topicId: string,
  result: Awaited<ReturnType<typeof videoService.createVideo>>,
  fallback: { model: string; prompt: string; provider: string },
) => {
  if (!result.success || !result.data)
    throw new Error(t('generation.status.failed', { ns: 'video' }));
  const { batch, generations } = result.data;
  if (!batch.id || store.generationBatchesMap[topicId]?.some((item) => item.id === batch.id))
    return;
  store.internal_dispatchGenerationBatch(topicId, {
    type: 'addBatch',
    value: {
      ...batch,
      config: batch.config as GenerationConfig,
      createdAt: batch.createdAt ?? new Date(),
      generations: generations.flatMap((generation) =>
        !generation.id || !generation.asyncTaskId
          ? []
          : [
              {
                ...generation,
                asyncTaskId: generation.asyncTaskId,
                createdAt: generation.createdAt ?? new Date(),
                id: generation.id,
                task: { id: generation.asyncTaskId, status: AsyncTaskStatus.Pending },
              },
            ],
      ),
      id: batch.id,
      model: batch.model ?? fallback.model,
      prompt: batch.prompt ?? fallback.prompt,
      provider: batch.provider ?? fallback.provider,
    },
  });
};

export const createCreateVideoSlice = (set: Setter, get: () => VideoStore, _api?: unknown) =>
  new CreateVideoActionImpl(set, get, _api);

export class CreateVideoActionImpl {
  readonly #get: () => VideoStore;
  readonly #set: Setter;

  constructor(set: Setter, get: () => VideoStore, _api?: unknown) {
    void _api;
    this.#set = set;
    this.#get = get;
  }

  createVideo = async (): Promise<void> => {
    if (this.#get().isCreating) return;
    this.#set({ isCreating: true }, false, 'createVideo/startCreateVideo');

    const store = this.#get();
    const parameters = videoGenerationConfigSelectors.parameters(store);
    const provider = videoGenerationConfigSelectors.provider(store);
    const model = videoGenerationConfigSelectors.model(store);
    const activeGenerationTopicId = generationTopicSelectors.activeGenerationTopicId(store);
    const { createGenerationTopic, switchGenerationTopic, setTopicBatchLoaded } = store;

    let finalTopicId = activeGenerationTopicId;
    try {
      if (!parameters) throw new TypeError('parameters is not initialized');
      if (!parameters.prompt?.trim()) throw new TypeError('prompt is empty');
      const schema = videoGenerationConfigSelectors.parametersSchema(store);
      const end = schema?.endImageUrl;
      if (
        end &&
        'requiresImageUrl' in end &&
        end.requiresImageUrl &&
        parameters.endImageUrl &&
        !parameters.imageUrl &&
        !parameters.imageUrls?.length
      ) {
        message.warning({
          content: t('generation.validation.endFrameRequiresStartFrame', { ns: 'video' }),
          duration: 3,
        });
        return;
      }
      if (!finalTopicId) {
        this.#set(
          { isCreatingWithNewTopic: true },
          false,
          'createVideo/startCreateVideoWithNewTopic',
        );
        finalTopicId = await createGenerationTopic([parameters.prompt]);
        setTopicBatchLoaded(finalTopicId);
        switchGenerationTopic(finalTopicId);
      }
      const result = await videoService.createVideo({
        generationTopicId: finalTopicId!,
        model,
        params: parameters as RuntimeVideoGenParams,
        provider,
      });
      publishAcceptedVideoTasks(this.#get(), finalTopicId!, result, {
        model,
        prompt: parameters.prompt,
        provider,
      });
      this.#set(
        (state) =>
          state.parameters.prompt === parameters.prompt
            ? { parameters: { ...state.parameters, prompt: '' } }
            : {},
        false,
        'createVideo/clearPrompt',
      );
      try {
        await this.#get().refreshGenerationBatches(finalTopicId!);
      } catch (error) {
        console.error('Failed to refresh accepted video tasks:', error);
      }
    } catch (error) {
      handleGenerationPromptModerationError(error);
      handleLobeHubModelDeprecatedError(error);
      throw error;
    } finally {
      this.#set(
        { isCreating: false, isCreatingWithNewTopic: false },
        false,
        'createVideo/endCreateVideo',
      );
    }
  };

  recreateVideo = async (generationBatchId: string): Promise<void> => {
    if (this.#get().isCreating) return;
    this.#set({ isCreating: true }, false, 'recreateVideo/start');

    const store = this.#get();
    const activeGenerationTopicId = generationTopicSelectors.activeGenerationTopicId(store);
    try {
      if (!activeGenerationTopicId) throw new Error('No active generation topic');
      const batch = generationBatchSelectors.getGenerationBatchByBatchId(generationBatchId)(store);
      if (!batch) throw new Error('Generation batch not found');
      const result = await videoService.createVideo({
        generationTopicId: activeGenerationTopicId,
        model: batch.model,
        params: batch.config as RuntimeVideoGenParams,
        provider: batch.provider,
      });
      publishAcceptedVideoTasks(this.#get(), activeGenerationTopicId, result, {
        model: batch.model,
        prompt: batch.prompt,
        provider: batch.provider,
      });
      try {
        await this.#get().refreshGenerationBatches(activeGenerationTopicId);
      } catch (error) {
        console.error('Failed to refresh regenerated video tasks:', error);
      }
    } catch (error) {
      handleGenerationPromptModerationError(error);
      handleLobeHubModelDeprecatedError(error);
      throw error;
    } finally {
      this.#set({ isCreating: false }, false, 'recreateVideo/end');
    }
  };
}

export type CreateVideoAction = Pick<CreateVideoActionImpl, keyof CreateVideoActionImpl>;
