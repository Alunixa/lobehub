// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConversationImageGenerationService } from './index';

const fixtures = vi.hoisted(() => ({
  createImage: vi.fn(),
  enabled: true,
  failFileCreate: false,
  files: new Map<string, Record<string, unknown>>(),
  modelAvailable: true,
  topic: {
    agentId: null as string | null,
    groupId: null as string | null,
    id: 'topic-1',
    sessionId: 'session-1',
  },
  topicFiles: [] as Array<{ id: string }>,
  uploaded: [] as string[],
}));

vi.mock('@/database/models/user', () => ({
  UserModel: class {
    getUserSettings = async () => ({
      systemAgent: {
        conversationImage: fixtures.enabled
          ? { enabled: true, model: 'image-v1', provider: 'openai' }
          : { enabled: false, model: '', provider: '' },
      },
    });
  },
}));

vi.mock('@/database/models/topic', () => ({
  TopicModel: class {
    findById = async () => fixtures.topic;
  },
}));

vi.mock('@/database/models/file', () => ({
  FileModel: class {
    findById = async (id: string) => fixtures.files.get(id);
    findByIds = async (ids: string[]) =>
      ids.flatMap((id) => {
        const file = fixtures.files.get(id);
        return file ? [file] : [];
      });
    findFilesToInitInSandbox = async () => fixtures.topicFiles;
    create = async (file: Record<string, unknown>) => {
      if (fixtures.failFileCreate) throw new Error('file record write failed');
      fixtures.files.set(file.id as string, file);
      return { id: file.id };
    };
  },
}));

vi.mock('@/database/models/agent', () => ({
  AgentModel: class {
    getAgentVisibility = async () => 'private';
  },
}));

vi.mock('@/database/models/chatGroup', () => ({
  ChatGroupModel: class {
    findById = async () => ({ visibility: 'private' });
  },
}));

vi.mock('@/database/repositories/aiInfra', () => ({
  AiInfraRepos: class {
    getEnabledModels = async () => [
      {
        enabled: fixtures.modelAvailable,
        id: 'image-v1',
        parameters: {
          imageUrls: { default: [] },
          prompt: { default: '' },
        },
        providerId: 'openai',
        type: 'image',
      },
    ];
  },
}));

vi.mock('@/server/globalConfig', () => ({
  getServerGlobalConfig: async () => ({ aiProvider: 'openai' }),
}));

vi.mock('@/server/modules/ModelRuntime', () => ({
  initModelRuntimeFromDB: async () => ({
    createImage: fixtures.createImage,
    getAuthHeaders: () => ({}),
  }),
}));

vi.mock('@/server/services/file', () => ({
  FileService: class {
    deleteFile = async (key: string) => {
      fixtures.uploaded = fixtures.uploaded.filter((item) => item !== key);
    };
    getFullFileUrl = async (key: string) => `https://storage.example/${key}`;
  },
  getFileProxyUrl: (id: string) => `/f/${id}`,
}));

vi.mock('@/server/services/generation', () => ({
  GenerationService: class {
    transformImageForGeneration = async () => {
      const buffer = Buffer.from('generated image');
      return {
        image: {
          buffer,
          extension: 'png',
          hash: 'image-hash',
          height: 768,
          mime: 'image/png',
          size: buffer.length,
          width: 1024,
        },
        thumbnailImage: {
          buffer,
          extension: 'png',
          hash: 'image-hash',
          height: 768,
          mime: 'image/png',
          size: buffer.length,
          width: 1024,
        },
      };
    };
    uploadImageForGeneration = async () => {
      fixtures.uploaded = ['generated/image.png'];
      return { imageUrl: 'generated/image.png', thumbnailImageUrl: 'generated/image.png' };
    };
  },
}));

vi.mock('@lobechat/business-model-runtime', () => ({
  resolveBusinessModelMapping: async (_provider: string, model: string) => ({
    resolvedModelId: model,
  }),
}));

vi.mock('@/utils/sanitizeFileName', () => ({
  sanitizeFileName: () => 'generated-image',
}));

describe('ConversationImageGenerationService', () => {
  beforeEach(() => {
    fixtures.enabled = true;
    fixtures.failFileCreate = false;
    fixtures.modelAvailable = true;
    fixtures.topic = { agentId: null, groupId: null, id: 'topic-1', sessionId: 'session-1' };
    fixtures.topicFiles = [];
    fixtures.files.clear();
    fixtures.uploaded = [];
    fixtures.createImage
      .mockReset()
      .mockResolvedValue({ imageUrl: 'https://provider.example/image.png' });
  });

  const createService = (requestId = 'tool-call-1') =>
    new ConversationImageGenerationService({
      requestId,
      serverDB: {} as never,
      topicId: 'topic-1',
      userId: 'user-1',
    });

  it('keeps generation disabled unless a model is explicitly selected', async () => {
    fixtures.enabled = false;

    await expect(createService().generateImage({ prompt: 'A snowy landscape.' })).rejects.toThrow(
      'Conversation image generation is disabled',
    );
    expect(fixtures.createImage).not.toHaveBeenCalled();
  });

  it('stores generated images and returns a stable, conversation-safe file URL', async () => {
    const result = await createService().generateImage({
      prompt: 'An anime girl in a snowy field.',
    });

    expect(result).toMatchObject({
      images: [
        { height: 768, url: expect.stringMatching(/^\/f\/file_[a-f0-9]{24}$/), width: 1024 },
      ],
      model: 'image-v1',
      provider: 'openai',
    });
    expect(fixtures.createImage).toHaveBeenCalledTimes(1);
    expect(fixtures.createImage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'image-v1',
        params: expect.objectContaining({ prompt: 'An anime girl in a snowy field.' }),
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const storedFile = fixtures.files.get(result.images[0].fileId);
    expect(storedFile).toMatchObject({
      fileType: 'image/png',
      metadata: {
        model: 'image-v1',
        prompt: 'An anime girl in a snowy field.',
        topicId: 'topic-1',
      },
      source: 'image_generation',
    });
    expect(storedFile?.url).toBe('generated/image.png');
  });

  it('reuses the completed result for the same tool-call request without regenerating', async () => {
    const params = { prompt: 'A snowy landscape.' };
    const first = await createService().generateImage(params);
    const second = await createService().generateImage(params);

    expect(second).toEqual(first);
    expect(fixtures.createImage).toHaveBeenCalledTimes(1);
  });

  it('rejects reference images from a different conversation before contacting the provider', async () => {
    fixtures.files.set('file-other-topic', {
      fileType: 'image/png',
      id: 'file-other-topic',
      metadata: { topicId: 'topic-2' },
      size: 100,
      url: 'other-topic/image.png',
      visibility: 'public',
    });

    await expect(
      createService().generateImage({
        prompt: 'Revise this picture.',
        referenceImageFileIds: ['file-other-topic'],
      }),
    ).rejects.toThrow('outside this conversation');
    expect(fixtures.createImage).not.toHaveBeenCalled();
  });

  it('allows a previously generated image from this conversation as an edit reference', async () => {
    fixtures.files.set('file-this-topic', {
      fileType: 'image/png',
      id: 'file-this-topic',
      metadata: { topicId: 'topic-1' },
      size: 100,
      url: 'this-topic/image.png',
      visibility: 'public',
    });

    await createService().generateImage({
      prompt: 'Keep the subject and add more snow.',
      referenceImageFileIds: ['file-this-topic'],
    });

    expect(fixtures.createImage).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          imageUrls: ['https://storage.example/this-topic/image.png'],
        }),
      }),
      expect.anything(),
    );
  });

  it('keeps generated images private when their workspace agent is private', async () => {
    fixtures.topic = {
      agentId: 'agent-private',
      groupId: null,
      id: 'topic-1',
      sessionId: 'session-1',
    };
    const service = new ConversationImageGenerationService({
      agentVisibility: 'private',
      requestId: 'tool-call-private-agent',
      serverDB: {} as never,
      topicId: 'topic-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });

    const result = await service.generateImage({ prompt: 'A private image.' });

    expect(fixtures.files.get(result.images[0].fileId)).toMatchObject({ visibility: 'private' });
  });

  it('does not use private workspace attachments in a public agent conversation', async () => {
    fixtures.topic = {
      agentId: 'agent-public',
      groupId: null,
      id: 'topic-1',
      sessionId: 'session-1',
    };
    fixtures.topicFiles = [{ id: 'file-private-attachment' }];
    fixtures.files.set('file-private-attachment', {
      fileType: 'image/png',
      id: 'file-private-attachment',
      metadata: {},
      size: 100,
      url: 'private/image.png',
      visibility: 'private',
    });
    const service = new ConversationImageGenerationService({
      agentVisibility: 'public',
      requestId: 'tool-call-public-agent',
      serverDB: {} as never,
      topicId: 'topic-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });

    await expect(
      service.generateImage({
        prompt: 'Edit the reference.',
        referenceImageFileIds: ['file-private-attachment'],
      }),
    ).rejects.toThrow('not accessible in this workspace');
    expect(fixtures.createImage).not.toHaveBeenCalled();
  });

  it('removes uploaded objects when persisting the generated image fails', async () => {
    fixtures.failFileCreate = true;

    await expect(createService().generateImage({ prompt: 'A temporary image.' })).rejects.toThrow(
      'file record write failed',
    );

    expect(fixtures.uploaded).toEqual([]);
    expect(fixtures.files.size).toBe(0);
  });

  it('does not call a model that became unavailable after its settings were saved', async () => {
    fixtures.modelAvailable = false;

    await expect(createService().generateImage({ prompt: 'A snowy landscape.' })).rejects.toThrow(
      'selected image model is unavailable',
    );
    expect(fixtures.createImage).not.toHaveBeenCalled();
  });
});
