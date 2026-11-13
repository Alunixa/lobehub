import type { BuiltinToolManifest } from '@lobechat/types';

import { systemPrompt } from './systemRole';
import { ImageGenerationApiName, ImageGenerationIdentifier } from './types';

export const ImageGenerationManifest: BuiltinToolManifest = {
  api: [
    {
      defaultTimeoutMs: 300_000,
      description:
        'Generate one image with the image model selected by the user in Service Models. ' +
        'Write an optimized, standalone prompt using the current request and relevant conversation history. ' +
        'For editing or visual continuity, optionally reference image file IDs from this conversation. ' +
        'Returns a stored image and its file ID, which can be referenced in later turns. Do not automatically retry.',
      name: ImageGenerationApiName.generateImage,
      parameters: {
        additionalProperties: false,
        properties: {
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
            maxItems: 8,
            type: 'array',
          },
        },
        required: ['prompt'],
        type: 'object',
      },
      renderDisplayControl: 'alwaysExpand',
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
