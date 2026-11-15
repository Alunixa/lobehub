import { describe, expect, it, vi } from 'vitest';

import { ImageGenerationExecutionRuntime } from './index';

describe('ImageGenerationExecutionRuntime', () => {
  const getImageModelCapabilities = vi.fn().mockResolvedValue({
    imageNum: { default: 1, min: 1, max: 50 },
    model: 'gpt-image-2',
    provider: 'image',
    parameters: { size: { default: 'auto', enum: ['auto', '3840x2160'] } },
  });

  it('rejects invalid arguments before calling the image service', async () => {
    const generateImage = vi.fn();
    const runtime = new ImageGenerationExecutionRuntime({
      generateImage,
      getImageModelCapabilities,
    });

    const result = await runtime.generateImage({ prompt: '   ' });

    expect(result).toMatchObject({ success: false, error: { code: 'INVALID_ARGUMENT' } });
    expect(result.content).toBeTruthy();
    expect(generateImage).not.toHaveBeenCalled();
  });

  it('returns the generated file ID and result state to the text agent', async () => {
    const runtime = new ImageGenerationExecutionRuntime({
      getImageModelCapabilities,
      generateImage: vi.fn().mockResolvedValue({
        images: [{ fileId: 'file_1', height: 768, url: '/f/file_1', width: 1024 }],
        model: 'image-v1',
        provider: 'provider',
      }),
    });

    const result = await runtime.generateImage({ prompt: 'A girl in a snowy field.' });

    expect(result).toMatchObject({
      state: {
        images: [{ fileId: 'file_1', url: '/f/file_1' }],
        model: 'image-v1',
        provider: 'provider',
      },
      success: true,
    });
    expect(result.content).toContain('file_1');
    expect(result.content).toContain('Actual dimensions: 1024x768 pixels');
  });

  it('does not retry a failed provider call and returns a non-empty actionable error', async () => {
    const generateImage = vi.fn().mockRejectedValue(new Error('Provider timeout'));
    const runtime = new ImageGenerationExecutionRuntime({
      generateImage,
      getImageModelCapabilities,
    });

    const result = await runtime.generateImage({ prompt: 'A girl in a snowy field.' });

    expect(result.success).toBe(false);
    expect(result.error).toMatchObject({ code: 'IMAGE_GENERATION_FAILED' });
    expect(result.content).toContain('Do not automatically retry');
    expect(generateImage).toHaveBeenCalledTimes(1);
  });

  it('honors cancellation before starting an image request', async () => {
    const generateImage = vi.fn();
    const runtime = new ImageGenerationExecutionRuntime({
      generateImage,
      getImageModelCapabilities,
    });
    const controller = new AbortController();
    controller.abort();

    const result = await runtime.generateImage(
      { prompt: 'A girl in a snowy field.' },
      { signal: controller.signal },
    );

    expect(result.success).toBe(false);
    expect(generateImage).not.toHaveBeenCalled();
  });

  it('reads capabilities without calling the paid image method', async () => {
    const generateImage = vi.fn();
    const runtime = new ImageGenerationExecutionRuntime({
      generateImage,
      getImageModelCapabilities,
    });
    const result = await runtime.getImageModelCapabilities({});
    expect(result.success).toBe(true);
    expect(JSON.parse(result.content!)).toMatchObject({
      parameters: { size: { enum: ['auto', '3840x2160'] } },
    });
    expect(generateImage).not.toHaveBeenCalled();
  });

  it('forwards structured controls and explicit batch count without hiding them in the prompt', async () => {
    const generateImage = vi.fn().mockResolvedValue({
      images: [{ fileId: 'f', url: '/f/f', width: 1024, height: 768 }],
      model: 'gpt-image-2',
      provider: 'image',
      requestedCount: 2,
      incompleteReason: 'Stopped',
    });
    const runtime = new ImageGenerationExecutionRuntime({
      generateImage,
      getImageModelCapabilities,
    });
    const params = { prompt: 'Landscape', imageNum: 2, options: { size: '3840x2160', seed: 0 } };
    const result = await runtime.generateImage(params);
    expect(generateImage).toHaveBeenCalledWith(params, undefined);
    expect(result.success).toBe(true);
    expect(result.content).toContain('1 of 2');
    expect(result.content).toContain('Partial result: Stopped');
    expect(result.content).toContain('Actual dimensions: 1024x768');
    expect(result.content).not.toContain('Actual dimensions: 3840');
    expect(result.state).toMatchObject({ incompleteReason: 'Stopped', requestedCount: 2 });
  });

  it.each([
    { prompt: 'x', options: { apiKey: 'forbidden' } },
    { prompt: 'x', options: { imageUrls: ['https://arbitrary.invalid'] } },
    { prompt: 'x', imageNum: 0 },
    { prompt: 'x', imageNum: 51 },
    { prompt: 'x', imageNum: 1.5 },
    { prompt: 'x', options: { seed: -1 } },
  ])('rejects unrecognized, media override and invalid count inputs: %j', async (params) => {
    const generateImage = vi.fn();
    const runtime = new ImageGenerationExecutionRuntime({
      generateImage,
      getImageModelCapabilities,
    });
    expect(await runtime.generateImage(params)).toMatchObject({
      success: false,
      error: { code: 'INVALID_ARGUMENT' },
    });
    expect(generateImage).not.toHaveBeenCalled();
  });

  it('returns a read failure without pretending the model has no controls', async () => {
    const runtime = new ImageGenerationExecutionRuntime({
      generateImage: vi.fn(),
      getImageModelCapabilities: vi.fn().mockRejectedValue(new Error('Configuration unavailable')),
    });
    expect(await runtime.getImageModelCapabilities({})).toMatchObject({
      success: false,
      content: 'Configuration unavailable',
      error: { code: 'IMAGE_CAPABILITIES_FAILED' },
    });
  });
});
