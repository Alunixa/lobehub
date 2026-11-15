import { z } from 'zod';

export const ImageGenerationIdentifier = 'lobe-image-generation';
export const ImageGenerationApiName = {
  generateImage: 'generateImage',
  getImageModelCapabilities: 'getImageModelCapabilities',
} as const;

export const MAX_CONVERSATION_IMAGES = 50;
export const MAX_CONVERSATION_IMAGE_REFERENCES = 64;

// These are the studio's non-media standard parameters. Model-specific limits
// are resolved and enforced on the server, never guessed from the prompt.
export const ImageGenerationOptionsSchema = z
  .object({
    aspectRatio: z.string().min(1).max(64).optional(),
    cfg: z.number().finite().optional(),
    height: z.number().int().positive().optional(),
    promptExtend: z.union([z.boolean(), z.string().max(128)]).optional(),
    quality: z.string().min(1).max(128).optional(),
    resolution: z.string().min(1).max(64).optional(),
    samplerName: z.string().min(1).max(128).optional(),
    scheduler: z.string().min(1).max(128).optional(),
    seed: z.number().int().nonnegative().nullable().optional(),
    size: z.string().min(1).max(64).optional(),
    steps: z.number().int().positive().optional(),
    strength: z.number().finite().optional(),
    watermark: z.boolean().optional(),
    webSearch: z.boolean().optional(),
    width: z.number().int().positive().optional(),
  })
  .strict();
export type ImageGenerationOptions = z.infer<typeof ImageGenerationOptionsSchema>;
export const ImageModelCapabilitiesParamsSchema = z.object({}).strict();

export const GenerateImageParamsSchema = z
  .object({
    imageNum: z.number().int().min(1).max(MAX_CONVERSATION_IMAGES).optional(),
    options: ImageGenerationOptionsSchema.optional(),
    prompt: z.string().trim().min(1).max(16_000),
    referenceImageFileIds: z
      .array(z.string().min(1))
      .max(MAX_CONVERSATION_IMAGE_REFERENCES)
      .optional(),
  })
  .strict();

export type GenerateImageParams = z.infer<typeof GenerateImageParamsSchema>;

export interface GeneratedConversationImage {
  fileId: string;
  height: number;
  url: string;
  width: number;
}

export interface GenerateImageState {
  images: GeneratedConversationImage[];
  /** Successful assets remain available when a later batch item fails or is cancelled. */
  incompleteReason?: string;
  model: string;
  provider: string;
  requestedCount?: number;
}

export interface ImageGenerationParameter {
  allowCustom?: boolean;
  default?: boolean | number | string | null;
  description?: string;
  enum?: string[];
  max?: number;
  min?: number;
  step?: number;
  type?: string | string[];
}

export interface ImageModelCapabilities {
  imageNum: { default: number; max: number; min: number };
  model: string;
  parameters: Record<string, ImageGenerationParameter>;
  provider: string;
  references?: { maxCount: number; maxFileSize?: number };
}

export interface ImageGenerationService {
  generateImage: (
    params: GenerateImageParams,
    options?: { signal?: AbortSignal },
  ) => Promise<GenerateImageState>;
  getImageModelCapabilities: (options?: {
    signal?: AbortSignal;
  }) => Promise<ImageModelCapabilities>;
}
