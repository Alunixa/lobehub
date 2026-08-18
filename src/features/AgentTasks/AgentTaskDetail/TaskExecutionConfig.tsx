import type { TaskSandboxMode } from '@lobechat/types';
import { Select } from '@lobehub/ui/base-ui';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { usePermission } from '@/hooks/usePermission';
import { serverConfigSelectors, useServerConfigStore } from '@/store/serverConfig';
import { useTaskStore } from '@/store/task';
import { taskDetailSelectors } from '@/store/task/selectors';

const TaskExecutionConfig = memo(() => {
  const { t } = useTranslation('chat');
  const { allowed: canEditTask } = usePermission('create_content');
  const taskId = useTaskStore(taskDetailSelectors.activeTaskId);
  const configuredMode = useTaskStore(taskDetailSelectors.activeTaskSandboxMode);
  const updateTaskSandboxMode = useTaskStore((state) => state.updateTaskSandboxMode);
  const serverProvider = useServerConfigStore(serverConfigSelectors.sandboxProvider);

  const mode: TaskSandboxMode =
    configuredMode ?? (serverProvider === 'host' ? 'host' : 'onlyboxes');

  const handleChange = useCallback(
    async (value: string) => {
      if (!canEditTask || !taskId) return;
      await updateTaskSandboxMode(taskId, value as TaskSandboxMode);
    },
    [canEditTask, taskId, updateTaskSandboxMode],
  );

  if (serverProvider === 'market') return null;

  return (
    <Select
      disabled={!canEditTask}
      style={{ minWidth: 128 }}
      value={mode}
      variant="filled"
      options={[
        { label: t('taskExecution.onlyboxes'), value: 'onlyboxes' },
        { label: t('taskExecution.host'), value: 'host' },
      ]}
      onChange={handleChange}
    />
  );
});

TaskExecutionConfig.displayName = 'TaskExecutionConfig';

export default TaskExecutionConfig;
