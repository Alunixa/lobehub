import { describe, expect, it, vi } from 'vitest';

import { ImageGenerationExecutionRuntime } from './index';

describe('ImageGenerationExecutionRuntime', () => {
  it('rejects invalid arguments before calling the image service', async () => {
    const generateImage = vi.fn();
    const runtime = new ImageGenerationExecutionRuntime({ generateImage });

    const result = await runtime.generateImage({ prompt: '   ' });

    expect(result).toMatchObject({ success: false, error: { code: 'INVALID_ARGUMENT' } });
    expect(result.content).toBeTruthy();
    expect(generateImage).not.toHaveBeenCalled();
  });

  it('returns the generated file ID and result state to the text agent', async () => {
    const runtime = new ImageGenerationExecutionRuntime({
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
  });

  it('does not retry a failed provider call and returns a non-empty actionable error', async () => {
    const generateImage = vi.fn().mockRejectedValue(new Error('Provider timeout'));
    const runtime = new ImageGenerationExecutionRuntime({ generateImage });

    const result = await runtime.generateImage({ prompt: 'A girl in a snowy field.' });

    expect(result.success).toBe(false);
    expect(result.error).toMatchObject({ code: 'IMAGE_GENERATION_FAILED' });
    expect(result.content).toContain('Do not automatically retry');
    expect(generateImage).toHaveBeenCalledTimes(1);
  });

  it('honors cancellation before starting an image request', async () => {
    const generateImage = vi.fn();
    const runtime = new ImageGenerationExecutionRuntime({ generateImage });
    const controller = new AbortController();
    controller.abort();

    const result = await runtime.generateImage(
      { prompt: 'A girl in a snowy field.' },
      { signal: controller.signal },
    );

    expect(result.success).toBe(false);
    expect(generateImage).not.toHaveBeenCalled();
  });
});
