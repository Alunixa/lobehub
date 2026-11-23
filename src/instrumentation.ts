const scheduledServices = new Set<string>();

const scheduleBackgroundService = (name: string, start: () => Promise<unknown>) => {
  if (scheduledServices.has(name)) return;
  scheduledServices.add(name);

  // Next waits for register() before serving any request, including readiness.
  // Defer both module loading and startup so background services cannot hold it open.
  setTimeout(() => {
    const run = async () => {
      try {
        await start();
      } catch (error) {
        console.error(`[Instrumentation] Failed to start ${name}:`, error);
      }
    };
    void run();
  }, 0).unref();
};

export async function register() {
  // In local development, write debug logs to logs/server.log
  if (process.env.NODE_ENV !== 'production' && process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./libs/debug-file-logger');
  }

  // Auto-start GatewayManager on server start for non-Vercel environments (Docker, local).
  // Persistent bots need reconnection after restart.
  // On Vercel, the cron job at /api/agent/gateway handles this reliably instead.
  // In local dev, opt-in via ENABLE_BOT_IN_DEV to avoid clobbering a shared bot binding.
  const isDev = process.env.NODE_ENV !== 'production';
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.DATABASE_URL &&
    !process.env.VERCEL_ENV &&
    (!isDev || process.env.ENABLE_BOT_IN_DEV === '1')
  ) {
    scheduleBackgroundService('GatewayManager', async () => {
      const { GatewayService } = await import('@/server/services/gateway');
      await new GatewayService().ensureRunning();
    });
  }

  // Self-hosted Node deployments do not have a QStash/Vercel cron process.
  // Start the persistent DB-backed task scanner and restore heartbeat timers
  // lost during the previous process shutdown.
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.DATABASE_URL &&
    !process.env.VERCEL_ENV &&
    (!isDev || process.env.ENABLE_TASKS_IN_DEV === '1')
  ) {
    scheduleBackgroundService('proactive conversation dispatcher', async () => {
      const { startProactiveConversationDispatcher } =
        await import('@/server/services/proactiveConversation/dispatch');
      startProactiveConversationDispatcher();
    });
    scheduleBackgroundService('local task dispatcher', async () => {
      const { startLocalTaskDispatcher } =
        await import('@/server/services/taskScheduler/localDispatcher');
      await startLocalTaskDispatcher();
    });
  }

  // Note: messenger system bot connections (Discord/Telegram) are managed
  // entirely from dc-center's System Bots admin — save / enable / forceReconnect
  // mutations call MessageGateway directly. The main app's only role here is
  // to receive forwarded events at `/api/agent/messenger/webhooks/<platform>`,
  // which doesn't require any startup work.

  if (process.env.NODE_ENV !== 'production' && !process.env.ENABLE_TELEMETRY_IN_DEV) {
    return;
  }

  const shouldEnable = process.env.ENABLE_TELEMETRY && process.env.NEXT_RUNTIME === 'nodejs';
  if (!shouldEnable) {
    return;
  }

  await import('./instrumentation.node');
}
