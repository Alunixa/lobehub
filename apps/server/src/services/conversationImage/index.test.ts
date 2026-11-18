// @vitest-environment node
import { once } from 'node:events';
import { createServer } from 'node:http';

import * as businessModelRuntime from '@lobechat/business-model-runtime';
import { LobeOpenAI } from '@lobechat/model-runtime';
import * as modelRuntime from '@lobechat/model-runtime';
import type { ModelParamsSchema } from 'model-bank';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConversationImageGenerationService } from './index';

const fixtures = vi.hoisted(() => ({
  afterFileCreate: undefined as (() => void) | undefined,
  businessFeatures: false,
  createImage: vi.fn(),
  enabled: true,
  failFileCreate: false,
  files: new Map<string, Record<string, unknown>>(),
  modelAvailable: true,
  modelId: 'image-v1',
  parameters: { imageUrls: { default: [] }, prompt: { default: '' } } as ModelParamsSchema,
  storageBase: 'https://storage.example',
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
          ? { enabled: true, model: fixtures.modelId, provider: 'openai' }
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
      fixtures.afterFileCreate?.();
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
        id: fixtures.modelId,
        parameters: fixtures.parameters,
        providerId: 'openai',
        type: 'image',
      },
    ];
  },
}));

vi.mock('@/server/globalConfig', () => ({
  getServerGlobalConfig: async () => ({
    aiProvider: 'openai',
    enableBusinessFeatures: fixtures.businessFeatures,
  }),
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
    getFullFileUrl = async (key: string) => `${fixtures.storageBase}/${key}`;
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

vi.mock('@/utils/sanitizeFileName', () => ({
  sanitizeFileName: () => 'generated-image',
}));

describe('ConversationImageGenerationService', () => {
  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    vi.spyOn(businessModelRuntime, 'resolveBusinessModelMapping').mockImplementation(
      async (_provider, model) => ({ resolvedModelId: model }),
    );
    fixtures.enabled = true;
    fixtures.afterFileCreate = undefined;
    fixtures.businessFeatures = false;
    fixtures.failFileCreate = false;
    fixtures.modelAvailable = true;
    fixtures.modelId = 'image-v1';
    fixtures.parameters = { imageUrls: { default: [] }, prompt: { default: '' } };
    fixtures.storageBase = 'https://storage.example';
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

  it('reads all current model capabilities without calling a provider or revealing media defaults', async () => {
    fixtures.modelId = 'gpt-image-2';
    fixtures.parameters = {} as ModelParamsSchema;
    const caps = await createService().getImageModelCapabilities();
    expect(caps).toMatchObject({
      model: 'gpt-image-2',
      provider: 'openai',
      imageNum: { default: 1, min: 1, max: 50 },
      parameters: { size: { allowCustom: true, enum: expect.arrayContaining(['3840x2160']) } },
      references: { maxCount: 16 },
    });
    expect(caps.parameters).not.toHaveProperty('imageUrls');
    expect(fixtures.createImage).not.toHaveBeenCalled();
    fixtures.enabled = false;
    await expect(createService().getImageModelCapabilities()).rejects.toThrow('disabled');
  });

  it('passes a real 4K size parameter, not only a prompt instruction, and preserves actual result dimensions', async () => {
    fixtures.modelId = 'gpt-image-2';
    fixtures.parameters = {} as ModelParamsSchema;
    const state = await createService().generateImage({
      prompt: 'Landscape',
      options: { size: '3840x2160' },
    });
    expect(fixtures.createImage.mock.calls[0][0].params.size).toBe('3840x2160');
    expect(state.images[0]).toMatchObject({ width: 1024, height: 768 });
    expect(fixtures.files.get(state.images[0].fileId)).toMatchObject({
      metadata: { generationOptions: { size: '3840x2160' }, width: 1024, height: 768 },
    });
  });

  it('forwards native aspect ratio, resolution, seed zero and disabled boolean controls', async () => {
    fixtures.parameters = {
      prompt: { default: '' },
      aspectRatio: { default: '1:1', enum: ['1:1', '16:9'] },
      resolution: { default: '1K', enum: ['1K', '4K'] },
      seed: { default: null },
      watermark: { default: true },
      webSearch: { default: true },
      promptExtend: { default: true },
    };
    const options = {
      aspectRatio: '16:9',
      resolution: '4K',
      seed: 0,
      watermark: false,
      webSearch: false,
      promptExtend: false,
    };
    await createService().generateImage({ prompt: 'Landscape', options });
    expect(fixtures.createImage.mock.calls[0][0].params).toMatchObject(options);
  });

  it('rejects unadvertised controls without sending any paid request', async () => {
    await expect(
      createService().generateImage({ prompt: 'Landscape', options: { resolution: '4K' } }),
    ).rejects.toThrow('not supported');
    expect(fixtures.createImage).not.toHaveBeenCalled();
  });

  it('generates the explicit batch with unique durable IDs and reuses the entire result', async () => {
    const args = { prompt: 'Three requested images', imageNum: 3 };
    const [a, b] = await Promise.all([
      createService().generateImage(args),
      createService().generateImage(args),
    ]);
    expect(a.images).toHaveLength(3);
    expect(new Set(a.images.map((image) => image.fileId)).size).toBe(3);
    expect(a.requestedCount).toBe(3);
    expect(b).toEqual(a);
    expect(await createService().generateImage(args)).toEqual(a);
    expect(fixtures.createImage).toHaveBeenCalledTimes(3);
  });

  it('keeps partial batch successes, stops scheduling new items and never refills on duplicate execution', async () => {
    fixtures.createImage.mockRejectedValueOnce(new Error('Provider rejected the first request'));
    const args = { prompt: 'Five requested images', imageNum: 5 };
    const result = await createService().generateImage(args);
    expect(result.images).toHaveLength(2);
    expect(result.requestedCount).toBe(5);
    expect(result.incompleteReason).toContain('Provider rejected');
    expect(fixtures.createImage).toHaveBeenCalledTimes(3);
    const repeated = await createService().generateImage(args);
    expect(repeated.images).toEqual(result.images);
    expect(repeated.incompleteReason).toBeTruthy();
    expect(fixtures.createImage).toHaveBeenCalledTimes(3);
  });

  it('does not start generation after cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      createService().generateImage(
        { prompt: 'Cancelled', imageNum: 4 },
        { signal: controller.signal },
      ),
    ).rejects.toThrow();
    expect(fixtures.createImage).not.toHaveBeenCalled();
  });

  it('keeps a saved image when a running batch is cancelled and does not start more items', async () => {
    const controller = new AbortController();
    fixtures.createImage
      .mockResolvedValueOnce({ imageUrl: 'https://provider.example/first.png' })
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockImplementationOnce(() => new Promise(() => {}));
    fixtures.afterFileCreate = () =>
      controller.abort(new DOMException('User stopped batch', 'AbortError'));
    const pending = createService().generateImage(
      { prompt: 'Five images', imageNum: 5 },
      { signal: controller.signal },
    );
    const result = await pending;
    expect(result.images).toHaveLength(1);
    expect(result.incompleteReason).toContain('User stopped batch');
    expect(fixtures.createImage).toHaveBeenCalledTimes(3);
  });
  it('enforces the same business batch limit as the studio', async () => {
    fixtures.businessFeatures = true;
    expect((await createService().getImageModelCapabilities()).imageNum.max).toBe(8);
    await expect(
      createService().generateImage({ prompt: 'Too many', imageNum: 9 }),
    ).rejects.toThrow('At most 8');
    expect(fixtures.createImage).not.toHaveBeenCalled();
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

  it.each(['gpt-image-2', 'gpt-image-2.6-sunburst'])(
    'accepts uploaded references for %s when the custom provider stores an empty schema',
    async (modelId) => {
      fixtures.modelId = modelId;
      fixtures.parameters = {} as ModelParamsSchema;
      fixtures.topicFiles = [{ id: 'upload-b' }, { id: 'upload-a' }];
      for (const id of ['upload-a', 'upload-b']) {
        fixtures.files.set(id, {
          fileType: 'image/png',
          id,
          metadata: {},
          size: 100,
          url: `${id}.png`,
          visibility: 'private',
        });
      }
      await createService().generateImage({
        prompt: 'Keep the person from the second upload and the style of the first.',
        referenceImageFileIds: ['upload-b', 'upload-a', 'upload-b'],
      });
      expect(fixtures.createImage.mock.calls[0][0].params.imageUrls).toEqual([
        'https://storage.example/upload-b.png',
        'https://storage.example/upload-a.png',
      ]);
    },
  );

  it('rejects references for a genuinely text-only image model before making a paid request', async () => {
    vi.spyOn(modelRuntime, 'resolveImageModelParameters').mockResolvedValue({
      prompt: { default: '' },
    });
    await expect(
      createService().generateImage({
        prompt: 'Edit this image.',
        referenceImageFileIds: ['upload'],
      }),
    ).rejects.toThrow('does not support reference images');
    expect(fixtures.createImage).not.toHaveBeenCalled();
  });

  it('keeps explicit single-image restrictions', async () => {
    fixtures.parameters = { imageUrl: { default: null }, prompt: { default: '' } };
    await expect(
      createService().generateImage({
        prompt: 'Blend both images.',
        referenceImageFileIds: ['one', 'two'],
      }),
    ).rejects.toThrow('only one reference image');
    expect(fixtures.createImage).not.toHaveBeenCalled();
  });

  it('enforces custom reference count and size limits', async () => {
    fixtures.parameters = {
      imageUrls: { default: [], maxCount: 1, maxFileSize: 99 },
      prompt: { default: '' },
    };
    await expect(
      createService().generateImage({
        prompt: 'Blend both images.',
        referenceImageFileIds: ['one', 'two'],
      }),
    ).rejects.toThrow('at most 1 reference');
    fixtures.topicFiles = [{ id: 'one' }];
    fixtures.files.set('one', {
      id: 'one',
      fileType: 'image/png',
      size: 100,
      metadata: {},
      url: 'one.png',
    });
    await expect(
      createService().generateImage({
        prompt: 'Edit this image.',
        referenceImageFileIds: ['one'],
      }),
    ).rejects.toThrow('file size limit');
    expect(fixtures.createImage).not.toHaveBeenCalled();
  });

  it('sends both authorized reference files in order through the real OpenAI edit HTTP request', async () => {
    fixtures.modelId = 'gpt-image-2';
    fixtures.parameters = {} as ModelParamsSchema;
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    const observed: {
      images: Buffer[];
      model: FormDataEntryValue | null;
      path: string;
      prompt: FormDataEntryValue | null;
      size: FormDataEntryValue | null;
    }[] = [];
    const server = createServer(async (request, response) => {
      if (request.method === 'GET') {
        response.writeHead(200, { 'content-type': 'image/png' });
        response.end(request.url === '/b.png' ? Buffer.concat([png, Buffer.from('b')]) : png);
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(chunk);
      const form = await new Response(Buffer.concat(chunks), {
        headers: { 'content-type': request.headers['content-type']! },
      }).formData();
      const files = [...form.getAll('image[]'), ...form.getAll('image')].filter(
        (item): item is File => item instanceof File,
      );
      observed.push({
        images: await Promise.all(files.map(async (file) => Buffer.from(await file.arrayBuffer()))),
        model: form.get('model'),
        path: request.url!,
        prompt: form.get('prompt'),
        size: form.get('size'),
      });
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ data: [{ b64_json: png.toString('base64') }] }));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No fixture port');
    fixtures.storageBase = `http://127.0.0.1:${address.port}`;
    fixtures.topicFiles = [{ id: 'ref-a' }, { id: 'ref-b' }];
    for (const [id, url] of [
      ['ref-a', 'a.png'],
      ['ref-b', 'b.png'],
    ]) {
      fixtures.files.set(id, {
        fileType: 'image/png',
        id,
        size: png.length,
        metadata: {},
        url,
        visibility: 'private',
      });
    }
    const runtime = new LobeOpenAI({
      apiKey: 'reference-wire-fixture',
      baseURL: `${fixtures.storageBase}/v1`,
      maxRetries: 0,
    });
    fixtures.createImage.mockImplementation((payload, options) =>
      runtime.createImage(payload, options),
    );
    try {
      const state = await createService('real-edit-wire').generateImage({
        prompt: 'Use both references in order.',
        referenceImageFileIds: ['ref-b', 'ref-a'],
        options: { size: '3840x2160' },
      });
      expect(state.images).toHaveLength(1);
      expect(observed).toHaveLength(1);
      expect(state.requestReceipt).toMatchObject({
        referenceImageFileIds: ['ref-b', 'ref-a'],
        referenceInput: 'imageUrls',
        resolvedModel: 'gpt-image-2',
        runtimeOptions: { size: '3840x2160' },
      });
      expect(JSON.stringify(state.requestReceipt)).not.toContain(fixtures.storageBase);
      const replay = await createService('real-edit-wire').generateImage({
        options: { size: '3840x2160' },
        prompt: 'Use both references in order.',
        referenceImageFileIds: ['ref-b', 'ref-a'],
      });
      expect(replay.requestReceipt).toEqual(state.requestReceipt);
      expect(observed).toHaveLength(1);
      expect(observed[0]).toMatchObject({
        model: 'gpt-image-2',
        path: '/v1/images/edits',
        prompt: 'Use both references in order.',
        size: '3840x2160',
      });
      expect(observed[0].images).toEqual([Buffer.concat([png, Buffer.from('b')]), png]);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
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
