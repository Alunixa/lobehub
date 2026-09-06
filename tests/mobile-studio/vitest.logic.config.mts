import path from 'node:path';

import { defineConfig } from 'vitest/config';

// Layout/navigation hooks do not need the app-wide antd/database initialization.
// Keep this fast lane independent while store integration tests use the root config.
export default defineConfig({
  define: { __DEV__: 'false', __ELECTRON__: 'false', __MOBILE__: 'true', __TEST__: 'true' },
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: [
      { find: '@/types', replacement: path.resolve('packages/types/src') },
      { find: '@', replacement: path.resolve('src') },
    ],
  },
  test: {
    environment: 'happy-dom',
    include: [
      'src/features/MobileApp/*.test.ts',
      'src/features/MobileApp/*.test.tsx',
      'src/features/ImageStudio/useImageStudio.test.tsx',
      'src/hooks/useIsMobile.test.ts',
      'src/hooks/useEnterToSend.test.ts',
      'src/spa/router/mobileRouter.test.tsx',
    ],
    maxWorkers: 2,
    minWorkers: 1,
  },
});
