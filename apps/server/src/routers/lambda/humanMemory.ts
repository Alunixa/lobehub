import type { UserMemorySettings } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { UserModel } from '@/database/models/user';
import { topics } from '@/database/schemas';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';
import { HumanMemoryService } from '@/server/services/humanMemory';
import { scheduleHumanMemoryTurn } from '@/server/services/humanMemory/turn';
import {
  getUserMemoryRetrievalMode,
  isConfiguredUserMemoryEmbedding,
  resolveUserMemoryEmbeddingRuntime,
} from '@/server/services/memory/userMemory/runtime';

const humanMemoryProcedure = authedProcedure
  .use(serverDatabase)
  .use(async ({ ctx, next }) =>
    next({ ctx: { humanMemory: new HumanMemoryService(ctx.serverDB, ctx.userId) } }),
  );

const coreMemoryInput = z.object({
  activeMatters: z.string().max(3200).nullable(),
  personaTone: z.string().max(3200).nullable(),
  userCore: z.string().max(3200).nullable(),
});

export const humanMemoryRouter = router({
  clearEpisodicMemories: humanMemoryProcedure.mutation(async ({ ctx }) => {
    await ctx.humanMemory.clearEpisodicMemories();
    return { success: true };
  }),

  getCoreMemory: humanMemoryProcedure.query(async ({ ctx }) => {
    return ctx.humanMemory.getCoreMemory();
  }),

  getEpisodicMemoryCount: humanMemoryProcedure.query(async ({ ctx }) => {
    const count = await ctx.humanMemory.getEpisodicMemoryCount();
    return { count };
  }),

  getStatus: humanMemoryProcedure.query(async ({ ctx }) => {
    const [core, count, settings] = await Promise.all([
      ctx.humanMemory.getCoreMemory(),
      ctx.humanMemory.getEpisodicMemoryCount(),
      new UserModel(ctx.serverDB, ctx.userId).getUserSettings(),
    ]);
    const memorySettings = settings?.memory as UserMemorySettings | undefined;
    const keyVaults = await KeyVaultsGateKeeper.getUserKeyVaults(
      settings?.keyVaults ?? null,
      ctx.userId,
    );
    const configured = isConfiguredUserMemoryEmbedding(memorySettings, keyVaults);
    const runtime = configured
      ? await resolveUserMemoryEmbeddingRuntime(ctx.serverDB, ctx.userId).catch(() => undefined)
      : undefined;
    const retrievalMode = getUserMemoryRetrievalMode(Boolean(runtime?.model), core?.retrievalMode);
    return {
      core: core
        ? { ...core, retrievalMode }
        : configured
          ? { retrievalMode, lastRecallCount: 0 }
          : null,
      count,
    };
  }),

  prepareContext: humanMemoryProcedure
    .input(
      z.object({
        userMessage: z.string().max(24_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const settings = (await new UserModel(ctx.serverDB, ctx.userId).getUserSettings())?.memory as
        UserMemorySettings | undefined;
      if (!settings?.humanMemoryEnabled) return { memoryPrompt: '', recalledCount: 0 };
      const prepared = await ctx.humanMemory.prepareContext({
        messages: [],
        userMessage: input.userMessage,
        embeddingModel: settings.humanMemoryEmbeddingModel,
      });
      return {
        memoryPrompt: prepared.memoryPrompt,
        recalledCount: prepared.recalledMemories.length,
      };
    }),

  recordTurn: humanMemoryProcedure
    .input(
      z.object({
        assistantReply: z.string().max(120_000),
        model: z.string().min(1).max(200),
        provider: z.string().min(1).max(64),
        topicId: z.string().optional(),
        userMessage: z.string().max(24_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.topicId) {
        const [topic] = await ctx.serverDB
          .select({ id: topics.id })
          .from(topics)
          .where(and(eq(topics.userId, ctx.userId), eq(topics.id, input.topicId)))
          .limit(1);
        if (!topic) throw new TRPCError({ code: 'NOT_FOUND' });
      }
      scheduleHumanMemoryTurn({ ...input, db: ctx.serverDB, userId: ctx.userId });
      return { success: true };
    }),

  updateCoreMemory: humanMemoryProcedure.input(coreMemoryInput).mutation(async ({ ctx, input }) => {
    return ctx.humanMemory.updateCoreMemory(input);
  }),
});
