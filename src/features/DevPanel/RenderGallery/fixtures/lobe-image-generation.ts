'use client';

import { defineFixtures, variants } from './_helpers';

// An embedded, local-only preview asset keeps devtools independent of providers and authentication.
const previewUrl = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#c4d7e5"/><path d="M0 360 Q160 280 280 360 T512 340 V512 H0Z" fill="#f3f7fc"/><circle cx="256" cy="248" r="38" fill="#f2d7ce"/><path d="M210 300 Q256 268 302 300 L325 430 H187Z" fill="#7986a8"/><path d="M214 246 Q206 180 256 184 T299 246Z" fill="#393b53"/></svg>',
)}`;
const imageState = {
  images: [{ fileId: 'file_preview-snow', height: 512, url: previewUrl, width: 512 }],
  model: 'configured-image-model',
  provider: 'configured-provider',
};

export default defineFixtures({
  identifier: 'lobe-image-generation',
  fixtures: {
    generateImage: variants([
      {
        args: { prompt: 'An anime-style girl in a snowy landscape, soft winter light.' },
        label: 'Generated image',
        pluginState: imageState,
      },
      {
        args: {
          prompt: 'Keep the same character and anime style, but change the scarf to red.',
          referenceImageFileIds: ['file_previous-image'],
        },
        label: 'Contextual revision',
        pluginState: imageState,
      },
      {
        args: { prompt: 'An anime-style girl in the snow.' },
        label: 'Provider failure',
        pluginError: {
          message: 'The selected image provider timed out.',
          type: 'PluginServerError',
        },
      },
      {
        args: { prompt: 'A snowfield.' },
        label: 'Empty result',
        pluginState: { ...imageState, images: [] },
      },
      {
        args: {
          prompt: 'Soft winter light, fine snowflakes and detailed anime scenery. '.repeat(80),
        },
        label: 'Long prompt',
        pluginState: imageState,
      },
    ]),
  },
});
