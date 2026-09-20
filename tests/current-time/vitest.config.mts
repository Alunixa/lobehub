import { readFileSync } from 'node:fs';
import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __DEV__: 'false', __ELECTRON__: 'false', __MOBILE__: 'false', __TEST__: 'true' },
  plugins: [
    {
      name: 'raw-skill-markdown',
      transform(_, id) {
        if (id.endsWith('.md')) {
          return {
            code: `export default ${JSON.stringify(readFileSync(id, 'utf8'))}`,
            map: null,
          };
        }
      },
    },
  ],
  resolve: {
    alias: [
      // Load the exact production exports needed by SkillsExecutionRuntime, avoiding
      // unrelated database/model-provider barrel initialization in this fast test lane.
      { find: '@lobechat/const', replacement: path.resolve('packages/const/src/skill.ts') },
      { find: '@lobechat/prompts', replacement: path.resolve('tests/current-time/prompts.ts') },
      {
        find: '@lobechat/utils/currentTime',
        replacement: path.resolve('packages/utils/src/currentTime.ts'),
      },
    ],
  },
  test: {
    environment: 'node',
    include: [
      'packages/utils/src/currentTime.test.ts',
      'apps/server/src/modules/ModelRuntime/currentTimeHook.test.ts',
      'packages/builtin-tool-skills/src/ExecutionRuntime/*.test.ts',
    ],
    maxWorkers: 2,
    minWorkers: 1,
  },
});
