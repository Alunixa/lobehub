import type { Context } from 'hono';

import { dispatchScheduledTasks } from '@/server/services/taskRunner/scheduleDispatch';

export interface ScheduleDispatchPayload {
  /** When true, only return what would be dispatched without firing executes. */
  dryRun?: boolean;
}

/**
 * Cron-style central dispatcher. Registered as a QStash Schedule (e.g.
 * `*\/30 * * * *`) pointing at this endpoint. On each tick:
 *
 *   1. Loads all schedule-mode tasks in dispatchable status (`scheduled`/`backlog`).
 *   2. Filters by cron pattern + timezone + last-run dedup (`isExecutionTime`).
 *   3. Fan-outs one QStash message per due task to `/schedule-execute`.
 *
 * No per-user authentication: this is a global sweep. Signature verification is
 * handled by the `qstashAuth` middleware on the route.
 */
export async function scheduleDispatch(c: Context) {
  try {
    const body = (await c.req.json().catch(() => ({}))) as ScheduleDispatchPayload;
    const { dryRun = false } = body ?? {};

    return c.json(await dispatchScheduledTasks({ dryRun }));
  } catch (error) {
    console.error('[task/schedule-dispatch] Error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Internal error' }, 500);
  }
}
