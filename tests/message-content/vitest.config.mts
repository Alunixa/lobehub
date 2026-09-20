import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __DEV__: 'false', __ELECTRON__: 'false', __MOBILE__: 'true', __TEST__: 'true' },
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: [
      { find: '@/utils', replacement: path.resolve('packages/utils/src') },
      { find: '@', replacement: path.resolve('src') },
    ],
  },
  test: {
    environment: 'happy-dom',
    include: [
      'src/features/MessageContentEditor/*.test.ts',
      'packages/conversation-flow/src/__tests__/orderMessagesWithContext.test.ts',
    ],
    maxWorkers: 2,
    minWorkers: 1,
  },
});
