import path from 'node:path';

import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __CI__: 'false', __DEV__: 'false', __ELECTRON__: 'false', __MOBILE__: 'false', __TEST__: 'true' },
  plugins: [
    tsconfigPaths({ projects: [path.resolve('tsconfig.json')] }),
    { name: 'raw-md', transform(_, id) {
      if (id.endsWith('.md')) return { code: 'export default ""', map: null };
    } },
  ],
  test: {
    environment: 'node',
    environmentMatchGlobs: [['**/packages/fetch-sse/**', 'happy-dom']],
    include: [
      'tests/stream-reliability/*.test.ts',
      'packages/utils/src/currentTime.test.ts',
      'packages/fetch-sse/src/__tests__/fetchSSE.test.ts',
      'apps/server/src/modules/ModelRuntime/currentTimeHook.test.ts',
      'apps/server/src/globalConfig/getServerGlobalConfig.test.ts',
      'apps/server/src/services/agentRuntime/__tests__/AbandonOperationService.test.ts',
      'src/store/chat/slices/agentRun/actions/__tests__/gateway.test.ts',
      'src/store/file/slices/chat/uploadGuard.test.ts',
    ],
    maxWorkers: 2,
  },
});
