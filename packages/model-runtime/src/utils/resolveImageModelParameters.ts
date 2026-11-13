import type { ModelParamsSchema } from 'model-bank';
import { CHAT_MODEL_IMAGE_GENERATION_PARAMS } from 'model-bank';

import { getModelPropertyWithFallback } from './getFallbackModelProperty';

interface ImageModelParametersInput {
  id: string;
  parameters?: ModelParamsSchema;
  providerId?: string;
}

/**
 * Share the same image capabilities between the studio and conversation tools.
 * Custom providers commonly store {}, which is not evidence of text-only input.
 */
export const resolveImageModelParameters = async ({
  id,
  parameters: inlineParameters,
  providerId,
}: ImageModelParametersInput): Promise<ModelParamsSchema> => {
  const fallbackIds = [id];
  if (!id.endsWith(':image')) fallbackIds.push(`${id}:image`);
  if (/^gpt-image-2(?:$|[.:-])/i.test(id) && id !== 'gpt-image-2') {
    fallbackIds.push('gpt-image-2');
  }

  let canonicalParameters: ModelParamsSchema | undefined;
  for (const fallbackId of fallbackIds) {
    canonicalParameters = await getModelPropertyWithFallback<ModelParamsSchema | undefined>(
      fallbackId,
      'parameters',
      providerId,
    );
    if (canonicalParameters && Object.keys(canonicalParameters).length > 0) break;
  }

  const parameters =
    canonicalParameters && Object.keys(canonicalParameters).length > 0
      ? { ...canonicalParameters, ...inlineParameters }
      : inlineParameters && Object.keys(inlineParameters).length > 0
        ? { ...inlineParameters }
        : CHAT_MODEL_IMAGE_GENERATION_PARAMS;

  return {
    ...parameters,
    prompt: parameters.prompt ?? CHAT_MODEL_IMAGE_GENERATION_PARAMS.prompt,
  };
};
