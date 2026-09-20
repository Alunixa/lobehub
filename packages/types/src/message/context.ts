import { z } from 'zod';

export const EditMessageContentSchema = z.object({
  content: z.string(),
  editorData: z.record(z.string(), z.unknown()).nullish(),
  fileIds: z.array(z.string().min(1)).max(100),
  id: z.string().min(1),
});

export const InsertContextMessageSchema = EditMessageContentSchema.extend({
  anchorId: z.string().min(1),
  position: z.enum(['before', 'after']),
  threadId: z.string().nullish(),
});

export type EditMessageContentParams = z.infer<typeof EditMessageContentSchema>;
export type InsertContextMessageParams = z.infer<typeof InsertContextMessageSchema>;
