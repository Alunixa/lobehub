import '../initialize';

import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

import { installMobileInputFocusGuard } from '@/features/MobileApp/inputFocusGuard';
import NextThemeProvider from '@/layout/GlobalProvider/NextThemeProvider';
import { bootTiming } from '@/libs/bootTiming';
import { createAppRouter } from '@/utils/router';

import { startAppInitialization } from './initialize/bootstrap';
import { mobileRoutes } from './router/mobileRouter.config';

bootTiming.mark('bundle-eval');
installMobileInputFocusGuard();
startAppInitialization();

const router = createAppRouter(mobileRoutes);

createRoot(document.getElementById('root')!).render(
  <NextThemeProvider>
    <RouterProvider router={router} />
  </NextThemeProvider>,
);
