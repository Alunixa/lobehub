import { z } from 'zod';

export const ImageGenerationIdentifier = 'lobe-image-generation';
export const ImageGenerationApiName = { generateImage: 'generateImage' } as const;

export const GenerateImageParamsSchema = z
  .object({
    prompt: z.string().trim().min(1).max(16_000),
    referenceImageFileIds: z.array(z.string().min(1)).max(8).optional(),
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
  model: string;
  provider: string;
}

export interface ImageGenerationService {
  generateImage: (
    params: GenerateImageParams,
    options?: { signal?: AbortSignal },
  ) => Promise<GenerateImageState>;
}
