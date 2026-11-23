import { z } from 'zod';

import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { HumanMemoryService } from '@/server/services/humanMemory';

const humanMemoryProcedure = authedProcedure.use(serverDatabase);

const coreMemoryInput = z.object({
  activeMatters: z.string().max(3200).nullable(),
  personaTone: z.string().max(3200).nullable(),
  userCore: z.string().max(3200).nullable(),
});

export const humanMemoryRouter = router({
  clearEpisodicMemories: humanMemoryProcedure.mutation(async ({ ctx }) => {
    await new HumanMemoryService(ctx.serverDB, ctx.userId).clearEpisodicMemories();
    return { success: true };
  }),

  getCoreMemory: humanMemoryProcedure.query(async ({ ctx }) => {
    return new HumanMemoryService(ctx.serverDB, ctx.userId).getCoreMemory();
  }),

  getEpisodicMemoryCount: humanMemoryProcedure.query(async ({ ctx }) => {
    const count = await new HumanMemoryService(ctx.serverDB, ctx.userId).getEpisodicMemoryCount();
    return { count };
  }),

  updateCoreMemory: humanMemoryProcedure.input(coreMemoryInput).mutation(async ({ ctx, input }) => {
    return new HumanMemoryService(ctx.serverDB, ctx.userId).updateCoreMemory(input);
  }),
});
