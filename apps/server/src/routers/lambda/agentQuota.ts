import { z } from 'zod';

import {
  AgentAccountBindingModel,
  AgentProviderAccountModel,
  AgentQuotaWindowModel,
} from '@/database/models/agentQuota';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { AgentQuotaService } from '@/server/services/agentQuota';

const quotaProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  return opts.next({
    ctx: {
      accountModel: new AgentProviderAccountModel(ctx.serverDB, ctx.userId),
      bindingModel: new AgentAccountBindingModel(ctx.serverDB, ctx.userId),
      quotaService: new AgentQuotaService(ctx.serverDB, ctx.userId),
      windowModel: new AgentQuotaWindowModel(ctx.serverDB, ctx.userId),
    },
  });
});

const providerSchema = z.enum(['claude-code', 'codex']);

export const agentQuotaRouter = router({
  // ── accounts ────────────────────────────────────────────────────────────
  createAccount: quotaProcedure
    .input(
      z.object({
        credentialMode: z.enum(['referenced', 'managed']).default('referenced'),
        label: z.string().optional(),
        provider: providerSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => ctx.accountModel.create(input)),

  deleteAccount: quotaProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.accountModel.delete(input.id)),

  listAccounts: quotaProcedure.query(async ({ ctx }) => ctx.accountModel.list()),

  updateAccount: quotaProcedure
    .input(
      z.object({
        id: z.string(),
        value: z.object({
          enabled: z.boolean().optional(),
          label: z.string().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => ctx.accountModel.update(input.id, input.value)),

  // ── bindings (agent ↔ account, incl. UI switch) ──────────────────────────
  bindAccount: quotaProcedure
    .input(
      z.object({
        accountId: z.string(),
        agentId: z.string(),
        priority: z.number().optional(),
        role: z.enum(['pinned', 'pool', 'disabled']).optional(),
        weight: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => ctx.bindingModel.upsert(input)),

  listBindings: quotaProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ ctx, input }) => ctx.bindingModel.listByAgent(input.agentId)),

  /** UI "switch account": pin one account for an agent, demoting any prior pin. */
  switchAccount: quotaProcedure
    .input(z.object({ accountId: z.string(), agentId: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.bindingModel.pin(input.agentId, input.accountId)),

  unbindAccount: quotaProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.bindingModel.remove(input.id)),

  // ── quota read (QuotaMenu read model) ────────────────────────────────────
  getWindows: quotaProcedure
    .input(z.object({ accountId: z.string(), limit: z.number().optional() }))
    .query(async ({ ctx, input }) => ctx.windowModel.listByAccount(input.accountId, input.limit)),

  // ── load balancing ───────────────────────────────────────────────────────
  resolveAccountLoads: quotaProcedure
    .input(z.object({ accountIds: z.array(z.string()) }))
    .query(async ({ ctx, input }) => ctx.quotaService.resolveAccountLoads(input.accountIds)),

  selectAccountForAgent: quotaProcedure
    .input(z.object({ agentId: z.string(), modelScope: z.string().optional() }))
    .query(async ({ ctx, input }) =>
      ctx.quotaService.selectForAgent(input.agentId, { modelScope: input.modelScope }),
    ),
});

export type AgentQuotaRouter = typeof agentQuotaRouter;
