import { ModelRuntime } from '@lobechat/model-runtime';
import { z } from 'zod';

import { withScopedPermission } from '@/business/server/trpc-middlewares/rbacPermission';
import { wsCompatProcedure } from '@/business/server/trpc-middlewares/workspaceAuth';
import { AiProviderModel } from '@/database/models/aiProvider';
import { NotificationModel } from '@/database/models/notification';
import { deletePushTokenByExpoTokenAndDevice } from '@/database/models/pushToken';
import { publicProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { resolveRuntimeProvider } from '@/server/modules/ModelRuntime';
import {
  getWebPushKeys,
  WebPushService,
  WebPushSubscriptionSchema,
} from '@/server/services/proactiveConversation/WebPushService';

const notificationProcedure = wsCompatProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      notificationModel: new NotificationModel(ctx.serverDB, ctx.userId),
      aiProviderModel: new AiProviderModel(ctx.serverDB, ctx.userId, ctx.workspaceId ?? undefined),
    },
  });
});
const notificationWriteProcedure = notificationProcedure.use(
  withScopedPermission('message:create'),
);

export const notificationRouter = router({
  conversationCapabilities: notificationProcedure
    .input(z.object({ providerId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const id = input?.providerId ?? 'openai';
      const provider = await ctx.aiProviderModel.getAiProviderById(id);
      return {
        backgroundAvailable: !process.env.VERCEL_ENV,
        requestCompressionAvailable: ModelRuntime.supportsRequestCompression(
          resolveRuntimeProvider(id, provider?.settings?.sdkType),
        ),
        webPushPublicKey: process.env.KEY_VAULTS_SECRET ? getWebPushKeys().publicKey : undefined,
      };
    }),
  archive: notificationWriteProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.notificationModel.archive(input.id);
    }),

  archiveAll: notificationWriteProcedure.mutation(async ({ ctx }) => {
    return ctx.notificationModel.archiveAll();
  }),

  list: notificationProcedure
    .input(
      z.object({
        category: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
        unreadOnly: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.notificationModel.list(input);
    }),

  markAllAsRead: notificationWriteProcedure.mutation(async ({ ctx }) => {
    return ctx.notificationModel.markAllAsRead();
  }),

  markAsRead: notificationWriteProcedure
    .input(z.object({ ids: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.notificationModel.markAsRead(input.ids);
    }),

  registerWebPush: notificationWriteProcedure
    .input(
      z.object({
        deviceId: z.string().uuid(),
        subscription: WebPushSubscriptionSchema,
      }),
    )
    .mutation(({ ctx, input }) =>
      new WebPushService(ctx.serverDB, ctx.userId).register(input.deviceId, input.subscription),
    ),

  unregisterWebPush: publicProcedure
    .use(serverDatabase)
    .input(
      z.object({
        deviceId: z.string().uuid(),
        registrationToken: z.string().startsWith('webpush:v1:').max(10000),
      }),
    )
    .mutation(({ ctx, input }) =>
      deletePushTokenByExpoTokenAndDevice(ctx.serverDB, {
        deviceId: `web:${input.deviceId}`,
        expoToken: input.registrationToken,
      }),
    ),

  unreadCount: notificationProcedure.query(async ({ ctx }) => {
    return ctx.notificationModel.getUnreadCount();
  }),
});

export type NotificationRouter = typeof notificationRouter;
