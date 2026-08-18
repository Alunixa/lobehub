import debug from 'debug';

import { BriefModel } from '@/database/models/brief';
import { TaskModel } from '@/database/models/task';
import { getServerDB } from '@/database/server';

const log = debug('task-runner:watchdog');

export interface TaskWatchdogResult {
  checked: number;
  failed: string[];
  success: true;
}

export async function runTaskWatchdog(): Promise<TaskWatchdogResult> {
  const db = await getServerDB();
  const stuckTasks = await TaskModel.findStuckTasks(db);
  const failed: string[] = [];

  for (const task of stuckTasks) {
    const workspaceId = task.workspaceId ?? undefined;
    const taskModel = new TaskModel(db, task.createdByUserId, workspaceId);
    await taskModel.updateStatus(task.id, 'failed', {
      completedAt: new Date(),
      error: 'Heartbeat timeout',
    });

    const briefModel = new BriefModel(db, task.createdByUserId, workspaceId);
    await briefModel.create({
      agentId: task.assigneeAgentId || undefined,
      priority: 'urgent',
      summary: `Task has been running without heartbeat update for more than ${task.heartbeatTimeout} seconds.`,
      taskId: task.id,
      title: `${task.identifier} heartbeat timeout`,
      trigger: 'task',
      type: 'error',
    });

    failed.push(task.identifier);
  }

  log('scan: checked=%d failed=%d', stuckTasks.length, failed.length);
  return { checked: stuckTasks.length, failed, success: true };
}
