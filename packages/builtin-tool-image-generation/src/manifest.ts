import type { BuiltinToolManifest } from '@lobechat/types';

import { systemPrompt } from './systemRole';
import {
  ImageGenerationApiName,
  ImageGenerationIdentifier,
  MAX_CONVERSATION_IMAGE_REFERENCES,
  MAX_CONVERSATION_IMAGES,
} from './types';

export const ImageGenerationManifest: BuiltinToolManifest = {
  api: [
    {
      defaultTimeoutMs: 300_000,
      description:
        'Generate images with the image model selected by the user in Service Models. ' +
        'First call getImageModelCapabilities to learn its current parameter names, allowed values and limits. ' +
        'Set real generation controls in options; writing a resolution in the prompt does not set it. ' +
        'Write an optimized, standalone prompt using the current request and relevant conversation history. ' +
        'For editing or visual continuity, optionally reference image file IDs from this conversation. ' +
        'Returns a stored image and its file ID, which can be referenced in later turns. Do not automatically retry.',
      name: ImageGenerationApiName.generateImage,
      parameters: {
        additionalProperties: false,
        properties: {
          imageNum: {
            description:
              'How many images the user explicitly requested. Default 1; never increase for unsolicited variants. ' +
              'Each image is a separate paid generation. Respect the capabilities imageNum.max.',
            maximum: MAX_CONVERSATION_IMAGES,
            minimum: 1,
            type: 'integer',
          },
          options: {
            additionalProperties: false,
            description:
              'Studio generation controls. Only send keys and exact legal values returned by getImageModelCapabilities. ' +
              'Omitted controls use model defaults. Reference URLs, provider/model overrides and arbitrary API fields are forbidden.',
            properties: {
              aspectRatio: {
                description:
                  'Native ratio, e.g. 16:9; use size instead if that is what the model supports.',
                type: 'string',
              },
              cfg: { description: 'Guidance scale.', type: 'number' },
              height: {
                description: 'Output height in pixels, for width/height models.',
                type: 'integer',
              },
              promptExtend: {
                description:
                  'Model prompt enhancement control; use the advertised boolean or string value.',
                type: ['boolean', 'string'],
              },
              quality: { description: 'Output quality preset.', type: 'string' },
              resolution: {
                description: 'Resolution tier, e.g. 1K, 2K or 4K. Only if supported.',
                type: 'string',
              },
              samplerName: { description: 'Sampling algorithm.', type: 'string' },
              scheduler: { description: 'Noise scheduler.', type: 'string' },
              seed: {
                description: 'Reproducible integer seed, or null for random.',
                type: ['integer', 'null'],
              },
              size: {
                description:
                  'Exact pixel size, e.g. 3840x2160, or an advertised preset such as auto.',
                type: 'string',
              },
              steps: { description: 'Sampling step count.', type: 'integer' },
              strength: { description: 'Image editing / denoising strength.', type: 'number' },
              watermark: {
                description: 'Enable or disable provider watermarking.',
                type: 'boolean',
              },
              webSearch: {
                description: 'Enable or disable model search grounding.',
                type: 'boolean',
              },
              width: {
                description: 'Output width in pixels, for width/height models.',
                type: 'integer',
              },
            },
            type: 'object',
          },
          prompt: {
            description:
              'The complete image prompt you have composed from the request and conversation context.',
            maxLength: 16_000,
            minLength: 1,
            type: 'string',
          },
          referenceImageFileIds: {
            description:
              'Optional image file IDs: copy the fileId attribute of uploaded <image> context entries, ' +
              'or Image file ID values returned by this tool. Use IDs in the intended reference order, ' +
              'not visual ref labels, message IDs, filenames or URLs.',
            items: { minLength: 1, type: 'string' },
            maxItems: MAX_CONVERSATION_IMAGE_REFERENCES,
            type: 'array',
          },
        },
        required: ['prompt'],
        type: 'object',
      },
      renderDisplayControl: 'alwaysExpand',
    },
    {
      description:
        'Read the configured conversation image model and all its studio controls, defaults, allowed values, ' +
        'custom size rules, reference-image limits and batch-count limit. Read-only, no generation or billing. ' +
        'Call before generation and whenever the selected model or requested settings change. ' +
        'Use supported controls in generateImage.options, rather than putting pixel sizes only in the prompt.',
      name: ImageGenerationApiName.getImageModelCapabilities,
      parameters: { additionalProperties: false, properties: {}, type: 'object' },
    },
  ],
  executors: ['server'],
  humanIntervention: 'never',
  identifier: ImageGenerationIdentifier,
  meta: {
    avatar: '🎨',
    description:
      'Generate images in conversation using the configured image model and context-aware prompts.',
    title: 'Conversation Image Generation',
  },
  systemRole: systemPrompt,
  type: 'builtin',
};
