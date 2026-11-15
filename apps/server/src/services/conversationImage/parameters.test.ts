import { ImageGenerationOptionsSchema } from '@lobechat/builtin-tool-image-generation';
import type { ModelParamsSchema } from 'model-bank';
import { ModelParamsMetaSchema } from 'model-bank';
import { describe, expect, it } from 'vitest';

import {
  getConversationImageParameterDefinitions,
  resolveConversationImageParameters,
} from './parameters';

const schema: ModelParamsSchema = {
  aspectRatio: { default: '1:1', enum: ['1:1', '16:9'] },
  cfg: { default: 7, min: 0, max: 20, step: 0.5 },
  height: { default: 1024, min: 256, max: 4096, step: 64 },
  imageUrl: { default: 'https://not-authorized.example/default.png' },
  imageUrls: { default: ['https://not-authorized.example/default.png'] },
  prompt: { default: '' },
  promptExtend: { default: false },
  quality: { default: 'standard', enum: ['standard', 'high'] },
  resolution: { default: '1K', enum: ['1K', '2K', '4K'] },
  samplerName: { default: 'euler', enum: ['euler', 'dpmpp'] },
  scheduler: { default: 'normal', enum: ['normal', 'karras'] },
  seed: { default: null, min: 0, max: 2147483647 },
  size: {
    default: 'auto',
    enum: ['auto', '1024x1024'],
    allowCustom: true,
    min: 256,
    max: 4096,
    step: 64,
  },
  steps: { default: 20, min: 1, max: 50 },
  strength: { default: 0.5 },
  watermark: { default: false },
  webSearch: { default: true },
  width: { default: 1024, min: 256, max: 4096, step: 64 },
};

describe('conversation image parameters', () => {
  it('exposes every standard studio parameter except prompt and authorized media inputs', () => {
    const fields = Object.keys(ModelParamsMetaSchema.shape)
      .filter((key) => !['prompt', 'imageUrl', 'imageUrls'].includes(key))
      .sort();
    expect(Object.keys(ImageGenerationOptionsSchema.shape).sort()).toEqual(fields);
    const definitions = getConversationImageParameterDefinitions(schema);
    expect(Object.keys(definitions).sort()).toEqual(fields);
    expect(definitions.size).toMatchObject({ allowCustom: true, min: 256, max: 4096, step: 64 });
    expect(JSON.stringify(definitions)).not.toContain('not-authorized');
  });

  it('keeps false, zero, null and explicit values instead of replacing them with defaults', () => {
    const params = resolveConversationImageParameters(schema, 'Landscape', {
      aspectRatio: '16:9',
      cfg: 0,
      height: 2160 - 48,
      promptExtend: false,
      quality: 'high',
      resolution: '4K',
      samplerName: 'dpmpp',
      scheduler: 'karras',
      seed: 0,
      size: '3840x2176',
      steps: 30,
      strength: 0,
      watermark: false,
      webSearch: false,
      width: 3840,
    });
    expect(params).toMatchObject({
      prompt: 'Landscape',
      aspectRatio: '16:9',
      cfg: 0,
      seed: 0,
      strength: 0,
      resolution: '4K',
      quality: 'high',
      promptExtend: false,
      watermark: false,
      webSearch: false,
    });
    expect(params).not.toHaveProperty('imageUrl');
    expect(params).not.toHaveProperty('imageUrls');
    expect(resolveConversationImageParameters(schema, 'x', { seed: null }).seed).toBeNull();
    expect(
      resolveConversationImageParameters(schema, 'x', { resolution: undefined }).resolution,
    ).toBe('1K');
  });

  it.each([
    [{ aspectRatio: '9:16' }, 'allowed values'],
    [{ resolution: '8K' }, 'allowed values'],
    [{ quality: 'ultra' }, 'allowed values'],
    [{ width: 128 }, 'minimum'],
    [{ height: 8192 }, 'maximum'],
    [{ width: 1000 }, 'step'],
    [{ cfg: 0.1 }, 'step'],
    [{ cfg: 25 }, 'maximum'],
    [{ strength: 1.5 }, 'maximum'],
    [{ steps: 51 }, 'maximum'],
    [{ seed: 2147483648 }, 'maximum'],
    [{ samplerName: 'invented' }, 'allowed values'],
    [{ scheduler: 'invented' }, 'allowed values'],
    [{ size: '0x1024' }, 'positive integers'],
    [{ size: '4097x1024' }, 'at most'],
    [{ size: '3333x1024' }, 'multiples'],
    [{ size: '3840×2160' }, 'WIDTHxHEIGHT'],
  ])('rejects invalid model-specific input before any provider request: %j', (options, message) => {
    expect(() => resolveConversationImageParameters(schema, 'x', options)).toThrow(message);
  });

  it('uses preset sizes verbatim, including 3840x2160, and allows only advertised custom dimensions', () => {
    const presets: ModelParamsSchema = {
      prompt: { default: '' },
      size: { default: 'auto', enum: ['auto', '3840x2160'] },
    };
    expect(resolveConversationImageParameters(presets, '4K image', { size: '3840x2160' })).toEqual({
      prompt: '4K image',
      size: '3840x2160',
    });
    expect(() => resolveConversationImageParameters(presets, 'x', { size: '4096x4096' })).toThrow(
      'allowed values',
    );
    expect(() => resolveConversationImageParameters(presets, 'x', { resolution: '4K' })).toThrow(
      'not supported',
    );
  });

  it('validates enum prompt enhancement and supports boolean enhancement independently', () => {
    const enumSchema: ModelParamsSchema = {
      prompt: { default: '' },
      promptExtend: { default: 'auto', enum: ['auto', 'off'] },
    };
    expect(
      resolveConversationImageParameters(enumSchema, 'x', { promptExtend: 'off' }).promptExtend,
    ).toBe('off');
    expect(() =>
      resolveConversationImageParameters(enumSchema, 'x', { promptExtend: false }),
    ).toThrow('expected string');
    expect(() =>
      resolveConversationImageParameters(enumSchema, 'x', { promptExtend: 'custom' }),
    ).toThrow('allowed values');
  });
});
