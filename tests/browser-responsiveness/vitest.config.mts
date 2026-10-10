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
    globals: true,
    include: [
      'tests/browser-responsiveness/*.test.ts',
      'packages/utils/src/client/cooperativeQueue.test.ts',
      'packages/utils/src/client/fetchEventSource/index.test.ts',
      'src/store/chat/slices/agentRun/actions/transports/gateway/gatewayEventQueue.test.ts',
      'src/store/chat/slices/agentRun/actions/__tests__/gatewayEventHandler.test.ts',
    ],
    maxWorkers: 2,
  },
});
