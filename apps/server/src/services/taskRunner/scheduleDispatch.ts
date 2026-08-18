import { isExecutionTime } from '@lobechat/utils/cronEval';
import debug from 'debug';

import { TaskModel } from '@/database/models/task';
import { getServerDB } from '@/database/server';
import { appEnv } from '@/envs/app';
import { qstashClient } from '@/libs/qstash';

import { runScheduleTick } from './scheduleTick';

const log = debug('task-runner:schedule-dispatch');
const SCHEDULE_EXECUTE_PATH = '/api/workflows/task/schedule-execute';

interface DueTask {
  pattern: string;
  taskId: string;
  taskIdentifier: string;
  timezone: string | null;
  userId: string;
}

export interface ScheduleDispatchResult {
  dispatched: number;
  dryRun: boolean;
  due: number;
  skipped: number;
  success: true;
  total: number;
}

export interface DispatchScheduledTasksOptions {
  dryRun?: boolean;
  now?: Date;
}

export async function dispatchScheduledTasks({
  dryRun = false,
  now = new Date(),
}: DispatchScheduledTasksOptions = {}): Promise<ScheduleDispatchResult> {
  const db = await getServerDB();
  const tasks = await TaskModel.getScheduledTasks(db);
  const due: DueTask[] = [];

  for (const task of tasks) {
    if (!task.schedulePattern) continue;
    if (
      !isExecutionTime({
        cronPattern: task.schedulePattern,
        currentTime: now,
        lastExecutedAt: task.lastHeartbeatAt ?? null,
        timezone: task.scheduleTimezone,
      })
    ) {
      continue;
    }

    due.push({
      pattern: task.schedulePattern,
      taskId: task.id,
      taskIdentifier: task.identifier,
      timezone: task.scheduleTimezone,
      userId: task.createdByUserId,
    });
  }

  log(
    'scan: total=%d due=%d skipped=%d dryRun=%s',
    tasks.length,
    due.length,
    tasks.length - due.length,
    dryRun,
  );

  const dispatched = dryRun || due.length === 0 ? 0 : await fanout(due);

  return {
    dispatched,
    dryRun,
    due: due.length,
    skipped: tasks.length - due.length,
    success: true,
    total: tasks.length,
  };
}

const fanout = async (due: DueTask[]): Promise<number> => {
  if (appEnv.enableQueueAgentRuntime) {
    if (!process.env.APP_URL) {
      throw new Error('APP_URL is required to fan out scheduled task executions via QStash');
    }
    const url = `${process.env.APP_URL.replace(/\/$/, '')}${SCHEDULE_EXECUTE_PATH}`;
    const results = await Promise.allSettled(
      due.map((item) =>
        qstashClient.publishJSON({
          body: { taskId: item.taskId, userId: item.userId },
          url,
        }),
      ),
    );

    return countSuccessfulDispatches(due, results, 'publish');
  }

  const results = await Promise.allSettled(
    due.map((item) => runScheduleTick(item.taskId, item.userId)),
  );
  return countSuccessfulDispatches(due, results, 'inline tick');
};

const countSuccessfulDispatches = (
  due: DueTask[],
  results: PromiseSettledResult<unknown>[],
  operation: string,
) => {
  let dispatched = 0;
  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      dispatched += 1;
      continue;
    }

    console.error(
      '[task/schedule-dispatch] failed to %s task=%s identifier=%s: %O',
      operation,
      due[index].taskId,
      due[index].taskIdentifier,
      result.reason,
    );
  }
  return dispatched;
};
