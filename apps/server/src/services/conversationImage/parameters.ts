import type {
  ImageGenerationOptions,
  ImageGenerationParameter,
} from '@lobechat/builtin-tool-image-generation';
import type { ModelParamsSchema, RuntimeImageGenParams } from 'model-bank';
import { extractDefaultValues, validateModelParamsSchema } from 'model-bank';

export const getConversationImageParameterDefinitions = (schema: ModelParamsSchema) => {
  const {
    imageUrl: _single,
    imageUrls: _multiple,
    prompt: _prompt,
    ...definitions
  } = validateModelParamsSchema(schema);
  // Storage URLs and file IDs are only accepted through the authorized reference path.
  return definitions satisfies Record<string, ImageGenerationParameter>;
};

export const resolveConversationImageParameters = (
  schema: ModelParamsSchema,
  prompt: string,
  options: ImageGenerationOptions = {},
): RuntimeImageGenParams => {
  const definitions = getConversationImageParameterDefinitions(schema);
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) continue;
    const definition: ImageGenerationParameter | undefined =
      definitions[key as keyof typeof definitions];
    const invalid = (detail: string): never => {
      throw new Error(
        `Invalid image option "${key}": ${detail}. Read getImageModelCapabilities; no image request was sent.`,
      );
    };
    if (!definition) return invalid('not supported by the selected model');
    if (value === null) {
      if (key !== 'seed') invalid('null is not supported');
      continue;
    }
    if (key === 'promptExtend') {
      const expected = definition.type ?? typeof definition.default;
      if (typeof value !== expected) invalid(`expected ${expected}`);
    } else if (typeof value !== typeof definition.default && definition.default !== null) {
      invalid(`expected ${typeof definition.default}`);
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) invalid('must be finite');
      if (definition.min !== undefined && value < definition.min)
        invalid(`minimum is ${definition.min}`);
      if (definition.max !== undefined && value > definition.max)
        invalid(`maximum is ${definition.max}`);
      if (definition.step) {
        const offset = (value - (definition.min ?? 0)) / definition.step;
        if (Math.abs(offset - Math.round(offset)) > 1e-6)
          invalid(`must follow step ${definition.step}`);
      }
    }
    if (
      typeof value === 'string' &&
      definition.enum &&
      !definition.enum.includes(value) &&
      (key !== 'size' || !definition.allowCustom)
    )
      invalid(`allowed values: ${definition.enum.join(', ')}`);
    if (key === 'size' && typeof value === 'string' && !definition.enum?.includes(value)) {
      const dimensions = /^(\d+)x(\d+)$/.exec(value);
      if (!dimensions) return invalid('expected a WIDTHxHEIGHT pixel size');
      for (const dimension of dimensions.slice(1).map(Number)) {
        if (!Number.isSafeInteger(dimension) || dimension <= 0)
          invalid('dimensions must be positive integers');
        if (definition.min !== undefined && dimension < definition.min)
          invalid(`each dimension must be at least ${definition.min}`);
        if (definition.max !== undefined && dimension > definition.max)
          invalid(`each dimension must be at most ${definition.max}`);
        if (definition.step && dimension % definition.step !== 0)
          invalid(`dimensions must be multiples of ${definition.step}`);
      }
    }
  }
  const defaults = extractDefaultValues(schema);
  // Never forward metadata-supplied media defaults without the conversation file checks.
  const { imageUrl: _single, imageUrls: _multiple, ...safeDefaults } = defaults;
  const explicit = Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined),
  );
  return { ...safeDefaults, ...explicit, prompt };
};
