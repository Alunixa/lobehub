import { TaskIdentifier as TaskSkillIdentifier } from '@lobechat/builtin-skills';
import { CloudSandboxIdentifier } from '@lobechat/builtin-tool-cloud-sandbox';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskRunnerService } from './index';

const mocks = vi.hoisted(() => ({
  agentModel: {
    getAgentModelConfig: vi.fn(),
    getBuiltinAgent: vi.fn(),
  },
  buildTaskPrompt: vi.fn(),
  execAgent: vi.fn(),
  taskModel: {
    getCheckpointConfig: vi.fn(),
    getReviewConfig: vi.fn(),
    incrementTopicCount: vi.fn(),
    resolve: vi.fn(),
    update: vi.fn(),
    updateCurrentTopic: vi.fn(),
    updateHeartbeat: vi.fn(),
    updateStatus: vi.fn(),
    updateTaskConfig: vi.fn(),
  },
  taskTopicModel: {
    add: vi.fn(),
    findByTaskId: vi.fn(),
  },
}));

vi.mock('@/database/models/agent', () => ({
  AgentModel: vi.fn().mockImplementation(() => mocks.agentModel),
}));

vi.mock('@/database/models/brief', () => ({
  BriefModel: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/database/models/task', () => ({
  TaskModel: vi.fn().mockImplementation(() => mocks.taskModel),
}));

vi.mock('@/database/models/taskTopic', () => ({
  TaskTopicModel: vi.fn().mockImplementation(() => mocks.taskTopicModel),
}));

vi.mock('@/server/services/aiAgent', () => ({
  AiAgentService: vi.fn().mockImplementation(() => ({ execAgent: mocks.execAgent })),
}));

vi.mock('@/server/services/taskLifecycle', () => ({
  TaskLifecycleService: vi.fn().mockImplementation(() => ({ onTopicComplete: vi.fn() })),
}));

vi.mock('./buildTaskPrompt', () => ({ buildTaskPrompt: mocks.buildTaskPrompt }));

const createTask = (sandboxMode?: 'host' | 'onlyboxes') => ({
  assigneeAgentId: 'agt_assignee',
  config: {
    execution: sandboxMode ? { sandboxMode } : undefined,
    model: 'gpt-5.6-luna',
    provider: 'gpt',
  },
  error: null,
  id: 'task-1',
  identifier: 'T-1',
  instruction: 'Inspect the runtime',
  lastHeartbeatAt: null,
  name: 'Runtime inspection',
  status: 'backlog',
  totalTopics: 0,
});

describe('TaskRunnerService.runTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildTaskPrompt.mockResolvedValue({ fileIds: [], prompt: 'Inspect the runtime' });
    mocks.execAgent.mockResolvedValue({
      messageId: 'message-1',
      operationId: 'operation-1',
      success: true,
      topicId: 'topic-1',
    });
    mocks.taskModel.getCheckpointConfig.mockReturnValue({ onAgentRequest: true });
    mocks.taskModel.getReviewConfig.mockReturnValue(null);
    mocks.taskTopicModel.findByTaskId.mockResolvedValue([]);
  });

  it('mounts command tools and routes host mode through the task execution runtime', async () => {
    mocks.taskModel.resolve.mockResolvedValue(createTask('host'));

    await new TaskRunnerService({} as any, 'user-1').runTask({ taskId: 'task-1' });

    expect(mocks.execAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalPluginIds: expect.arrayContaining([
          TaskSkillIdentifier,
          CloudSandboxIdentifier,
        ]),
        forceTaskExecutionRuntime: true,
        sandboxProvider: 'host',
      }),
    );
  });

  it('mounts command tools while leaving the server default provider in control', async () => {
    mocks.taskModel.resolve.mockResolvedValue(createTask());

    await new TaskRunnerService({} as any, 'user-1').runTask({ taskId: 'task-1' });

    const params = mocks.execAgent.mock.calls[0][0];
    expect(params.additionalPluginIds).toContain(CloudSandboxIdentifier);
    expect(params.forceTaskExecutionRuntime).toBe(true);
    expect(params.sandboxProvider).toBeUndefined();
  });
});
