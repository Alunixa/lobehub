import type { RuntimeImageGenParams } from 'model-bank';

import { handleGenerationPromptModerationError } from '@/business/client/handleGenerationPromptModerationError';
import { handleLobeHubModelDeprecatedError } from '@/business/client/handleLobeHubModelDeprecatedError';
import { imageService } from '@/services/image';
import type { StoreSetter } from '@/store/types';
import { AsyncTaskStatus } from '@/types/asyncTask';
import type { GenerationConfig } from '@/types/generation';

import type { ImageStore } from '../../store';
import { generationBatchSelectors } from '../generationBatch/selectors';
import { imageGenerationConfigSelectors } from '../generationConfig/selectors';
import { generationTopicSelectors } from '../generationTopic';

type Setter = StoreSetter<ImageStore>;

export interface RecreateImageOptions {
  model: string;
  params: RuntimeImageGenParams;
  provider: string;
}

const publishAcceptedImageTasks = (
  store: ImageStore,
  generationTopicId: string,
  result: Awaited<ReturnType<typeof imageService.createImage>>,
  fallback: { model: string; prompt: string; provider: string },
) => {
  const { batch, generations } = result.data;
  const alreadyLoaded = store.generationBatchesMap[generationTopicId]?.some(
    (item) => item.id === batch.id,
  );
  if (!batch.id || alreadyLoaded) return;

  store.internal_dispatchGenerationBatch(generationTopicId, {
    type: 'addBatch',
    value: {
      ...batch,
      config: batch.config as GenerationConfig,
      createdAt: batch.createdAt ?? new Date(),
      generations: generations.flatMap((generation) => {
        if (!generation.id || !generation.asyncTaskId) return [];
        return [
          {
            ...generation,
            asyncTaskId: generation.asyncTaskId,
            createdAt: generation.createdAt ?? new Date(),
            id: generation.id,
            task: { id: generation.asyncTaskId, status: AsyncTaskStatus.Pending },
          },
        ];
      }),
      id: batch.id,
      model: batch.model ?? fallback.model,
      prompt: batch.prompt ?? fallback.prompt,
      provider: batch.provider ?? fallback.provider,
    },
  });
};

export const createCreateImageSlice = (set: Setter, get: () => ImageStore, _api?: unknown) =>
  new CreateImageActionImpl(set, get, _api);

export class CreateImageActionImpl {
  readonly #get: () => ImageStore;
  readonly #set: Setter;

  constructor(set: Setter, get: () => ImageStore, _api?: unknown) {
    // keep signature aligned with StateCreator params: (set, get, api)
    void _api;
    this.#set = set;
    this.#get = get;
  }

  async createImage() {
    // A second tap (or shortcut) must never submit another billable request.
    if (this.#get().isCreating) return;

    this.#set({ isCreating: true }, false, 'createImage/startCreateImage');

    const store = this.#get();
    const imageNum = imageGenerationConfigSelectors.imageNum(store);
    const parameters = imageGenerationConfigSelectors.parameters(store);
    const provider = imageGenerationConfigSelectors.provider(store);
    const model = imageGenerationConfigSelectors.model(store);
    const activeGenerationTopicId = generationTopicSelectors.activeGenerationTopicId(store);
    const { createGenerationTopic, switchGenerationTopic, setTopicBatchLoaded } = store;

    let finalTopicId = activeGenerationTopicId;
    const isNewTopic = !activeGenerationTopicId;

    try {
      if (!parameters) throw new TypeError('parameters is not initialized');
      if (!parameters.prompt?.trim()) throw new TypeError('prompt is empty');

      if (isNewTopic) {
        this.#set(
          { isCreatingWithNewTopic: true },
          false,
          'createImage/startCreateImageWithNewTopic',
        );
        finalTopicId = await createGenerationTopic([parameters.prompt]);
        setTopicBatchLoaded(finalTopicId);
        switchGenerationTopic(finalTopicId);
      }

      const result = await imageService.createImage({
        generationTopicId: finalTopicId!,
        provider,
        model,
        imageNum,
        params: parameters as any,
      });

      // Publish the accepted tasks immediately, including the first mobile request.
      // Neither a mounted sidebar nor a successful follow-up GET is required.
      publishAcceptedImageTasks(this.#get(), finalTopicId!, result, {
        model,
        prompt: parameters.prompt,
        provider,
      });

      // Do not erase a draft edited while the request was in flight.
      this.#set(
        (state) =>
          state.parameters?.prompt === parameters.prompt
            ? { parameters: { ...state.parameters, prompt: '' } }
            : {},
        false,
        'createImage/clearPrompt',
      );

      // A failed refresh is not a failed generation: retrying POST could bill twice.
      try {
        await this.#get().refreshGenerationBatches(finalTopicId!);
      } catch (error) {
        console.error('Failed to refresh accepted image tasks:', error);
      }
    } catch (error) {
      handleGenerationPromptModerationError(error);
      handleLobeHubModelDeprecatedError(error);
      throw error;
    } finally {
      this.#set(
        { isCreating: false, isCreatingWithNewTopic: false },
        false,
        'createImage/endCreateImage',
      );
    }
  }

  async recreateImage(generationBatchId: string, options?: RecreateImageOptions) {
    if (this.#get().isCreating) return;

    this.#set({ isCreating: true }, false, 'recreateImage/startCreateImage');

    const store = this.#get();

    try {
      const activeGenerationTopicId = generationTopicSelectors.activeGenerationTopicId(store);
      if (!activeGenerationTopicId) throw new Error('No active generation topic');

      const batch = generationBatchSelectors.getGenerationBatchByBatchId(generationBatchId)(store);
      if (!batch) throw new Error('Generation batch not found');

      // Use batch.generations.length to preserve original imageNum (not UI config)
      const imageNum = batch.generations.length;
      const model = options?.model ?? batch.model;
      const provider = options?.provider ?? batch.provider;
      const params = {
        ...batch.config,
        ...options?.params,
        prompt: options?.params.prompt || batch.config?.prompt || batch.prompt,
      } as RuntimeImageGenParams;

      // Regeneration is non-destructive: keep the previous task visible until
      // the replacement request has been accepted and published.
      const result = await imageService.createImage({
        generationTopicId: activeGenerationTopicId,
        provider,
        model,
        imageNum,
        params,
      });
      publishAcceptedImageTasks(store, activeGenerationTopicId, result, {
        model,
        prompt: params.prompt,
        provider,
      });

      try {
        await store.refreshGenerationBatches(activeGenerationTopicId);
      } catch (error) {
        console.error('Failed to refresh accepted regenerated image tasks:', error);
      }
    } catch (error) {
      handleGenerationPromptModerationError(error);
      handleLobeHubModelDeprecatedError(error);
      throw error;
    } finally {
      this.#set({ isCreating: false }, false, 'recreateImage/endCreateImage');
    }
  }
}

export type CreateImageAction = Pick<CreateImageActionImpl, keyof CreateImageActionImpl>;
