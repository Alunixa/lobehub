import path from 'node:path';

import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __CI__: 'false',
    __DEV__: 'false',
    __ELECTRON__: 'false',
    __MOBILE__: 'false',
    __TEST__: 'true',
  },
  plugins: [
    tsconfigPaths({ projects: [path.resolve('tsconfig.json')] }),
    {
      name: 'raw-md',
      transform(_, id) {
        if (id.endsWith('.md')) return { code: 'export default ""', map: null };
      },
    },
  ],
  test: {
    environment: 'node',
    environmentMatchGlobs: [['**/packages/fetch-sse/**', 'happy-dom']],
    globals: true,
    include: [
      'tests/chat-diagnostics/*.test.ts',
      'tests/stream-reliability/*.test.ts',
      'apps/server/src/modules/AgentRuntime/__tests__/RuntimeExecutors.test.ts',
      'src/store/chat/slices/agentRun/actions/__tests__/gatewayEventHandler.test.ts',
      'packages/fetch-sse/src/__tests__/fetchSSE.test.ts',
    ],
    maxWorkers: 2,
  },
});
