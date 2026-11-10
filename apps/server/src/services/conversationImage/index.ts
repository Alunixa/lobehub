import type {
  GenerateImageParams,
  GenerateImageState,
} from '@lobechat/builtin-tool-image-generation';
import { ASYNC_TASK_TIMEOUT } from '@lobechat/business-config/server';
import { resolveBusinessModelMapping } from '@lobechat/business-model-runtime';
import { INBOX_SESSION_ID } from '@lobechat/const';
import type { ProviderConfig, UserServiceModelConfig } from '@lobechat/types';
import { FileSource, RequestTrigger } from '@lobechat/types';
import { raceWithAbort } from '@lobechat/utils/abort';
import { resolveConversationImageModel } from '@lobechat/utils/conversationImageModel';
import { sha256 } from 'js-sha256';
import type { ModelParamsSchema, RuntimeImageGenParams } from 'model-bank';
import { CHAT_MODEL_IMAGE_GENERATION_PARAMS, extractDefaultValues } from 'model-bank';

import { AgentModel } from '@/database/models/agent';
import { AgentOperationModel } from '@/database/models/agentOperation';
import { ChatGroupModel } from '@/database/models/chatGroup';
import { FileModel } from '@/database/models/file';
import { TopicModel } from '@/database/models/topic';
import { UserModel } from '@/database/models/user';
import { AiInfraRepos } from '@/database/repositories/aiInfra';
import type { FileItem } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { getServerGlobalConfig } from '@/server/globalConfig';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';
import { FileService, getFileProxyUrl } from '@/server/services/file';
import { GenerationService } from '@/server/services/generation';
import { sanitizeFileName } from '@/utils/sanitizeFileName';

interface ConversationImageContext {
  agentVisibility?: 'private' | 'public' | null;
  operationId?: string;
  requestId: string;
  serverDB: LobeChatDatabase;
  topicId: string;
  userId: string;
  workspaceId?: string;
}

// Share only identical tool calls, not prompts across conversations or users.
const inFlight = new Map<string, Promise<GenerateImageState>>();

export class ConversationImageGenerationService {
  constructor(private context: ConversationImageContext) {}

  generateImage = async (
    params: GenerateImageParams,
    options?: { signal?: AbortSignal },
  ): Promise<GenerateImageState> => {
    const { serverDB, userId, workspaceId, topicId, requestId } = this.context;
    if (!topicId || !requestId) throw new Error('A conversation and tool call ID are required.');
    options?.signal?.throwIfAborted();

    // Read on EVERY call: disabling the feature takes effect even in a running conversation.
    const settings = await new UserModel(serverDB, userId).getUserSettings();
    const config = resolveConversationImageModel(
      (settings?.systemAgent as Partial<UserServiceModelConfig> | undefined)?.conversationImage,
    );
    if (!config) {
      throw new Error(
        'Conversation image generation is disabled. Select an image model in Settings > Service Models.',
      );
    }
    const { model, provider } = config;
    const topic = await new TopicModel(serverDB, userId, workspaceId).findById(topicId);
    if (!topic) throw new Error('The conversation is unavailable.');
    // Intersect workspace sharing rules: a private group or agent must never
    // cause its generated file to become workspace-public.
    const visibilityCandidates: ('private' | 'public')[] = [];
    if (workspaceId && topic.groupId) {
      const group = await new ChatGroupModel(serverDB, userId, workspaceId).findById(topic.groupId);
      if (!group) throw new Error('The conversation group is unavailable.');
      visibilityCandidates.push(group.visibility === 'public' ? 'public' : 'private');
    }
    if (workspaceId && topic.agentId && topic.agentId !== INBOX_SESSION_ID) {
      const agentVisibility =
        this.context.agentVisibility ??
        (await new AgentModel(serverDB, userId, workspaceId).getAgentVisibility(topic.agentId));
      if (!agentVisibility) throw new Error('The conversation agent is unavailable.');
      visibilityCandidates.push(agentVisibility);
    }
    // Missing ownership (including the inbox agent) fails private.
    const visibility: 'private' | 'public' = visibilityCandidates.every((item) => item === 'public')
      ? 'public'
      : 'private';

    const key = sha256(
      JSON.stringify([userId, workspaceId ?? null, topicId, requestId, config, params]),
    );
    const fileId = `file_${key.slice(0, 24)}`;
    const fileModel = new FileModel(serverDB, userId, workspaceId);
    const toState = (file: Pick<FileItem, 'id' | 'metadata'>): GenerateImageState => {
      const metadata = file.metadata as { height?: number; width?: number } | null;
      return {
        images: [
          {
            fileId: file.id,
            height: metadata?.height ?? 1024,
            url: getFileProxyUrl(file.id),
            width: metadata?.width ?? 1024,
          },
        ],
        model,
        provider,
      };
    };
    const existing = await fileModel.findById(fileId);
    if (existing) {
      if (workspaceId && visibility === 'public' && existing.visibility === 'private') {
        throw new Error(
          'The earlier image belongs to a private conversation and cannot be shared here.',
        );
      }
      return toState(existing);
    }
    const pending = inFlight.get(key);
    if (pending) return pending;

    const generation = this.generate(params, fileId, config, visibility, options?.signal);
    inFlight.set(key, generation);
    try {
      return await generation;
    } finally {
      if (inFlight.get(key) === generation) inFlight.delete(key);
    }
  };

  private async generate(
    params: GenerateImageParams,
    fileId: string,
    config: { model: string; provider: string },
    visibility: 'private' | 'public',
    signal?: AbortSignal,
  ): Promise<GenerateImageState> {
    const { serverDB, userId, workspaceId, topicId, operationId } = this.context;
    const { model, provider } = config;
    const { aiProvider } = await getServerGlobalConfig();
    const models = await new AiInfraRepos(
      serverDB,
      userId,
      aiProvider as unknown as Record<string, ProviderConfig>,
      workspaceId,
    ).getEnabledModels();
    const selectedModel = models.find(
      (item) =>
        item.providerId === provider && item.id === model && item.type === 'image' && item.enabled,
    );
    if (!selectedModel)
      throw new Error(
        'The selected image model is unavailable. Enable it or choose another image model in Service Models.',
      );

    const schema: ModelParamsSchema = {
      ...(selectedModel.parameters ?? CHAT_MODEL_IMAGE_GENERATION_PARAMS),
      prompt: selectedModel.parameters?.prompt ?? CHAT_MODEL_IMAGE_GENERATION_PARAMS.prompt,
    };
    const generationParams: RuntimeImageGenParams = {
      ...extractDefaultValues(schema),
      prompt: params.prompt,
    };
    const fileService = new FileService(serverDB, userId, workspaceId);
    const fileModel = new FileModel(serverDB, userId, workspaceId);
    const references = [...new Set(params.referenceImageFileIds ?? [])];
    if (references.length) {
      if (!schema.imageUrl && !schema.imageUrls) {
        throw new Error(
          'The selected image model does not support reference images. Choose an image-editing model or request a new text-to-image generation.',
        );
      }
      if (!schema.imageUrls && references.length > 1) {
        throw new Error('The selected image model accepts only one reference image.');
      }
      if (
        schema.imageUrls?.maxCount !== undefined &&
        references.length > schema.imageUrls.maxCount
      ) {
        throw new Error(
          `The selected image model accepts at most ${schema.imageUrls.maxCount} reference images.`,
        );
      }
      const [files, conversationFiles] = await Promise.all([
        fileModel.findByIds(references),
        fileModel.findFilesToInitInSandbox(topicId),
      ]);
      const conversationFileIds = new Set(conversationFiles.map((file) => file.id));
      if (
        files.length !== references.length ||
        files.some(
          (file) =>
            !file.fileType.startsWith('image/') ||
            ((file.metadata as { topicId?: string } | null)?.topicId !== topicId &&
              !conversationFileIds.has(file.id)) ||
            (workspaceId && visibility === 'public' && file.visibility === 'private'),
        )
      ) {
        throw new Error(
          'A reference image is unavailable, outside this conversation, or not accessible in this workspace.',
        );
      }
      const maxFileSize = schema.imageUrls?.maxFileSize ?? schema.imageUrl?.maxFileSize;
      if (maxFileSize && files.some((file) => file.size > maxFileSize)) {
        throw new Error('A reference image exceeds the selected image model’s file size limit.');
      }
      const urls = await Promise.all(
        references.map(async (id) => {
          const file = files.find((item) => item.id === id)!;
          return fileService.getFullFileUrl(file.url);
        }),
      );
      if (schema.imageUrls) generationParams.imageUrls = urls;
      else generationParams.imageUrl = urls[0];
    }

    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const timeout = setTimeout(
      () => controller.abort(new DOMException('Image generation timed out.', 'TimeoutError')),
      ASYNC_TASK_TIMEOUT,
    );
    timeout.unref?.();
    let checking = false;
    let disposed = false;
    const operationModel = operationId
      ? new AgentOperationModel(serverDB, userId, workspaceId)
      : undefined;
    const checkCancellation = async () => {
      if (!operationModel || !operationId || checking || disposed) return;
      checking = true;
      try {
        const operation = await operationModel.findById(operationId);
        if ((!operation || operation.status === 'interrupted') && !disposed)
          controller.abort(new DOMException('Image generation cancelled.', 'AbortError'));
      } catch (error) {
        console.error('[conversation-image] Failed to check cancellation', error);
      } finally {
        checking = false;
      }
    };
    const poll = operationId ? setInterval(() => void checkCancellation(), 1000) : undefined;
    poll?.unref?.();
    let uploadedKeys: string[] = [];
    let stored = false;
    try {
      await checkCancellation();
      controller.signal.throwIfAborted();
      const runtime = await initModelRuntimeFromDB(serverDB, userId, provider, workspaceId);
      const { resolvedModelId } = await resolveBusinessModelMapping(provider, model);
      controller.signal.throwIfAborted();
      const response = await raceWithAbort(
        runtime.createImage(
          {
            model: resolvedModelId,
            params: generationParams,
          },
          {
            metadata: { operationId, topicId, trigger: RequestTrigger.Image },
            signal: controller.signal,
          },
        ),
        controller.signal,
      );
      controller.signal.throwIfAborted();
      if (!response?.imageUrl) throw new Error('The image provider returned no image.');
      const generationService = new GenerationService(serverDB, userId, workspaceId);
      const { image, thumbnailImage } = await raceWithAbort(
        generationService.transformImageForGeneration(
          response.imageUrl,
          provider === 'comfyui' ? runtime.getAuthHeaders() : undefined,
          controller.signal,
        ),
        controller.signal,
      );
      controller.signal.throwIfAborted();
      const uploaded = await generationService.uploadImageForGeneration(image, thumbnailImage, {
        signal: controller.signal,
      });
      uploadedKeys = [...new Set([uploaded.imageUrl, uploaded.thumbnailImageUrl])];
      controller.signal.throwIfAborted();
      // Both the file id and storage key are durable; no expiring provider URL or base64 enters history.
      await fileModel.create(
        {
          fileHash: image.hash,
          fileType: image.mime,
          id: fileId,
          metadata: {
            height: image.height,
            model,
            path: uploaded.imageUrl,
            prompt: params.prompt,
            provider,
            thumbnailUrl: uploaded.thumbnailImageUrl,
            topicId,
            width: image.width,
          },
          name: `${sanitizeFileName(params.prompt, fileId)}.${image.extension}`,
          size: image.size,
          source: FileSource.ImageGeneration,
          url: uploaded.imageUrl,
          ...(workspaceId ? { visibility } : {}),
        },
        true,
      );
      stored = true;
      return {
        images: [
          { fileId, height: image.height, url: getFileProxyUrl(fileId), width: image.width },
        ],
        model,
        provider,
      };
    } finally {
      disposed = true;
      clearTimeout(timeout);
      clearInterval(poll);
      signal?.removeEventListener('abort', abort);
      if (!stored && uploadedKeys.length) {
        const cleanup = await Promise.allSettled(
          uploadedKeys.map((key) => fileService.deleteFile(key)),
        );
        cleanup.forEach((result) => {
          if (result.status === 'rejected')
            console.error(
              '[conversation-image] Failed to clean up an unstored image',
              result.reason,
            );
        });
      }
    }
  }
}
