// Credentials arrive on stdin and stay in memory. All production writes are blocked.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { chromium, devices, expect } from '@playwright/test';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const { appUrl, cookie, outputDir } = JSON.parse(input);
const origin = new URL(appUrl).origin;
const output = path.resolve(outputDir);
await mkdir(output, { recursive: true });
const results = [];
const blockedWrites = [];
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  headless: true,
});
try {
  for (const mobile of [true, false]) {
    const context = await browser.newContext({
      ...(mobile ? devices['iPhone 13'] : { viewport: { width: 1440, height: 900 } }),
      ignoreHTTPSErrors: true,
      locale: 'zh-CN',
    });
    await context.addCookies([
      { name: '__Secure-better-auth.session_token', value: cookie, url: origin, secure: true },
    ]);
    await context.route('**/*', (route) => {
      const request = route.request();
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        blockedWrites.push({ method: request.method(), path: new URL(request.url()).pathname });
        return route.fulfill({
          status: 503,
          body: '{"error":"Read-only verification"}',
          contentType: 'application/json',
        });
      }
      return route.continue();
    });
    const page = await context.newPage();
    for (const route of mobile
      ? ['/image', '/tools', '/settings', '/settings/security']
      : ['/image']) {
      const runtimeErrors = [];
      const onError = (error) => runtimeErrors.push(error.name);
      page.on('pageerror', onError);
      await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
      if (route === '/image') {
        await expect(page.getByTestId('image-studio')).toBeVisible({ timeout: 45000 });
        await expect(page.locator('#image-studio-prompt')).toBeEnabled({ timeout: 30000 });
      } else if (route === '/settings/security') {
        await expect(page.getByTestId('mobile-security')).toBeVisible({ timeout: 30000 });
      } else {
        await expect(page.locator('[data-mobile-shell]')).toBeVisible({ timeout: 30000 });
      }
      const dimensions = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      assert(dimensions.scrollWidth <= dimensions.width + 1);
      assert.equal(runtimeErrors.length, 0);
      assert(!page.url().includes('/signin'));
      results.push({ dimensions, mobile, path: route, runtimeErrors: runtimeErrors.length });
      if (route === '/image') {
        await page.screenshot({
          path: path.join(output, mobile ? 'mobile-live.png' : 'desktop-live.png'),
        });
      }
      page.off('pageerror', onError);
    }
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(
    path.join(output, 'live-report.json'),
    JSON.stringify({ blockedWrites, results }, null, 2),
  );
}
console.info(JSON.stringify({ blockedWrites: blockedWrites.length, results }, null, 2));
