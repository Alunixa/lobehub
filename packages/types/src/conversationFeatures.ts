import { z } from 'zod';

export const ConversationFeaturesSchema = z.object({
  compressImages: z.boolean().optional(),
  compressRequests: z.boolean().optional(),
  inputTimestamps: z.boolean().optional(),
  outputTimestamps: z.boolean().optional(),
  proactiveMessages: z.boolean().optional(),
  proactiveNotifications: z.boolean().optional(),
  proactiveRepeats: z.boolean().optional(),
  typingAwareness: z.boolean().optional(),
});

export type ConversationFeatures = z.infer<typeof ConversationFeaturesSchema>;

export const MessageAwarenessSchema = z.object({
  composedForMs: z
    .number()
    .int()
    .min(0)
    .max(7 * 24 * 60 * 60 * 1000)
    .optional(),
  sentAt: z.string().datetime({ offset: true }).optional(),
});

export interface MessageAwareness extends z.infer<typeof MessageAwarenessSchema> {
  outputFinishedAt?: string;
  responseElapsedMs?: number;
}

export const ProactiveDecisionSchema = z
  .object({
    idleForSeconds: z
      .number()
      .int()
      .min(1)
      .max(366 * 24 * 3600)
      .optional(),
    reason: z.string().max(1000).optional(),
    sendAt: z.string().datetime({ offset: true }).optional(),
  })
  .refine((decision) => Boolean(decision.sendAt) !== (decision.idleForSeconds !== undefined));

export type ProactiveDecision = z.infer<typeof ProactiveDecisionSchema>;

export interface ProactiveConversationPlan {
  decision: ProactiveDecision;
  dueAt: string;
  id: string;
  operationId?: string;
  sourceActivitySequence?: number;
  sourceMessageId: string;
  sourceUserMessageId?: string;
  status: 'scheduled' | 'running' | 'sent' | 'skipped' | 'cancelled' | 'failed';
  threadId?: string;
}

export interface ConversationFeatureDetail {
  features: ConversationFeatures;
  plan?: ProactiveConversationPlan | null;
  updatedAt: number;
}
