// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LocalTaskDispatcher, restoreHeartbeatSchedules } from './localDispatcher';

const mocks = vi.hoisted(() => ({
  dispatchScheduledTasks: vi.fn().mockResolvedValue({ success: true }),
  getHeartbeatTasks: vi.fn(),
  runTaskWatchdog: vi.fn().mockResolvedValue({ success: true }),
  scheduleNextTopic: vi.fn(),
  updateContext: vi.fn(),
}));

vi.mock('@/database/server', () => ({ getServerDB: vi.fn().mockResolvedValue({}) }));
vi.mock('@/database/models/task', () => ({
  TaskModel: class {
    static getHeartbeatTasks = mocks.getHeartbeatTasks;
    updateContext = mocks.updateContext;
  },
}));
vi.mock('@/envs/app', () => ({ appEnv: { enableQueueAgentRuntime: false } }));
vi.mock('@/server/services/taskRunner/scheduleDispatch', () => ({
  dispatchScheduledTasks: mocks.dispatchScheduledTasks,
}));
vi.mock('@/server/services/taskRunner/watchdog', () => ({
  runTaskWatchdog: mocks.runTaskWatchdog,
}));
vi.mock('./impls', () => ({
  createTaskSchedulerModule: () => ({ scheduleNextTopic: mocks.scheduleNextTopic }),
}));

describe('local task dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getHeartbeatTasks.mockResolvedValue([]);
    mocks.scheduleNextTopic.mockResolvedValue('local-tick-1');
    mocks.updateContext.mockResolvedValue({});
    mocks.dispatchScheduledTasks.mockResolvedValue({ success: true });
    mocks.runTaskWatchdog.mockResolvedValue({ success: true });
  });

  it('restores a heartbeat with only its remaining delay after restart', async () => {
    const now = new Date('2026-08-18T12:00:00.000Z');
    mocks.getHeartbeatTasks.mockResolvedValue([
      {
        context: { scheduler: { dueAt: '2026-08-18T12:00:12.000Z' } },
        createdByUserId: 'user-1',
        heartbeatInterval: 30,
        id: 'task-1',
        workspaceId: null,
      },
    ]);

    await expect(restoreHeartbeatSchedules(now)).resolves.toBe(1);
    expect(mocks.scheduleNextTopic).toHaveBeenCalledWith({
      delay: 12,
      taskId: 'task-1',
      userId: 'user-1',
    });
    expect(mocks.updateContext).toHaveBeenCalledWith('task-1', {
      scheduler: expect.objectContaining({
        dueAt: '2026-08-18T12:00:12.000Z',
        tickMessageId: 'local-tick-1',
      }),
    });
  });

  it('runs schedule dispatch and watchdog on a scan', async () => {
    const dispatcher = new LocalTaskDispatcher();

    await dispatcher.tick();

    expect(mocks.dispatchScheduledTasks).toHaveBeenCalledOnce();
    expect(mocks.runTaskWatchdog).toHaveBeenCalledOnce();
  });

  it('does not overlap slow scans', async () => {
    let finish!: () => void;
    mocks.dispatchScheduledTasks.mockImplementation(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    const dispatcher = new LocalTaskDispatcher();

    const first = dispatcher.tick();
    await Promise.resolve();
    await dispatcher.tick();
    finish();
    await first;

    expect(mocks.dispatchScheduledTasks).toHaveBeenCalledOnce();
    expect(mocks.runTaskWatchdog).toHaveBeenCalledOnce();
  });
});
