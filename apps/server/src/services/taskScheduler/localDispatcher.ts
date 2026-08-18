import type { TaskSchedulerContext } from '@lobechat/types';
import debug from 'debug';

import { TaskModel } from '@/database/models/task';
import { getServerDB } from '@/database/server';
import { appEnv } from '@/envs/app';
import { dispatchScheduledTasks } from '@/server/services/taskRunner/scheduleDispatch';
import { runTaskWatchdog } from '@/server/services/taskRunner/watchdog';

import { createTaskSchedulerModule } from './impls';

const log = debug('task-scheduler:local-dispatcher');
const DEFAULT_SCAN_INTERVAL_MS = 30_000;

const readScanInterval = () => {
  const value = Number(process.env.LOCAL_TASK_DISPATCH_INTERVAL_MS);
  return Number.isFinite(value) && value >= 1000 ? value : DEFAULT_SCAN_INTERVAL_MS;
};

export async function restoreHeartbeatSchedules(now = new Date()): Promise<number> {
  const db = await getServerDB();
  const tasks = await TaskModel.getHeartbeatTasks(db);
  const scheduler = createTaskSchedulerModule();
  let restored = 0;

  for (const task of tasks) {
    const intervalSeconds = task.heartbeatInterval!;
    const schedulerContext =
      ((task.context as { scheduler?: TaskSchedulerContext } | null) ?? {}).scheduler ?? {};
    const storedDueAt = schedulerContext.dueAt
      ? Date.parse(schedulerContext.dueAt)
      : schedulerContext.scheduledAt
        ? Date.parse(schedulerContext.scheduledAt) + intervalSeconds * 1000
        : Number.NaN;
    const dueAt = Number.isFinite(storedDueAt) ? storedDueAt : now.getTime();
    const delay = Math.max(0, Math.ceil((dueAt - now.getTime()) / 1000));
    const tickMessageId = await scheduler.scheduleNextTopic({
      delay,
      taskId: task.id,
      userId: task.createdByUserId,
    });

    const taskModel = new TaskModel(db, task.createdByUserId, task.workspaceId ?? undefined);
    await taskModel.updateContext(task.id, {
      scheduler: {
        dueAt: new Date(now.getTime() + delay * 1000).toISOString(),
        scheduledAt: now.toISOString(),
        tickMessageId,
      },
    });
    restored += 1;
  }

  log('restored heartbeat timers: %d', restored);
  return restored;
}

export class LocalTaskDispatcher {
  private running = false;
  private timer?: NodeJS.Timeout;

  constructor(private readonly intervalMs = readScanInterval()) {}

  async start(): Promise<void> {
    if (this.timer) return;

    await restoreHeartbeatSchedules();
    await this.tick();

    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
    this.timer.unref?.();
    log('started persistent task scan every %dms', this.intervalMs);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  async tick(): Promise<void> {
    if (this.running) {
      log('skip overlapping scan');
      return;
    }

    this.running = true;
    try {
      const results = await Promise.allSettled([dispatchScheduledTasks(), runTaskWatchdog()]);
      for (const result of results) {
        if (result.status === 'rejected') {
          console.error('[LocalTaskDispatcher] scan failed:', result.reason);
        }
      }
    } finally {
      this.running = false;
    }
  }
}

let dispatcher: LocalTaskDispatcher | undefined;

export async function startLocalTaskDispatcher(): Promise<LocalTaskDispatcher | undefined> {
  if (appEnv.enableQueueAgentRuntime || process.env.DISABLE_LOCAL_TASK_DISPATCHER === '1') return;
  if (dispatcher) return dispatcher;

  dispatcher = new LocalTaskDispatcher();
  try {
    await dispatcher.start();
    return dispatcher;
  } catch (error) {
    dispatcher = undefined;
    throw error;
  }
}
