// Production credentials arrive on stdin and remain in memory.
// The script creates one temporary custom-context message and always removes it in finally.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import { chromium, devices, expect } from '@playwright/test';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';

const COOKIE_NAME = '__Secure-better-auth.session_token';
const MESSAGE_SELECTOR = (id) => `[data-message-id="${id}"]`;

let input = '';
for await (const chunk of process.stdin) input += chunk;

const { agentId, anchorId, appUrl, cookie, outputDir, topicId } = JSON.parse(input);
for (const [key, value] of Object.entries({ agentId, anchorId, appUrl, cookie, outputDir, topicId })) {
  assert.equal(typeof value, 'string', `${key} must be a string`);
  assert(value.length > 0, `${key} must not be empty`);
}

const origin = new URL(appUrl).origin;
const chatUrl = `${origin}/agent/${encodeURIComponent(agentId)}/${encodeURIComponent(topicId)}`;
const output = path.resolve(outputDir);
await mkdir(output, { recursive: true });

const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const messageId = `msg_realtime_verify_${runId}`;
const insertedContent = `realtime-sync-insert-${runId}`;
const editedContent = `realtime-sync-edit-${runId}`;
const report = {
  chatPath: new URL(chatUrl).pathname,
  cleanup: { attempted: false, completed: false },
  messageId,
  pages: {},
  runId,
  sync: {},
};

const trpc = createTRPCClient({
  links: [
    httpBatchLink({
      fetch: (url, init) =>
        fetch(url, {
          ...init,
          headers: {
            ...Object.fromEntries(new Headers(init?.headers).entries()),
            cookie: `${COOKIE_NAME}=${cookie}`,
            origin,
          },
        }),
      transformer: superjson,
      url: `${origin}/trpc/lambda`,
    }),
  ],
});

const withTimeout = async (promise, timeoutMs, message) => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

const createRealtimeTracker = (page, label) => {
  const state = {
    closed: 0,
    errors: [],
    ready: 0,
    sockets: 0,
    updates: 0,
  };
  const waiters = new Set();

  const flush = () => {
    for (const waiter of waiters) {
      if (state.ready < waiter.count) continue;
      waiters.delete(waiter);
      waiter.resolve();
    }
  };

  page.on('websocket', (socket) => {
    if (!socket.url().includes('/api/trpc-ws')) return;
    state.sockets += 1;
    socket.on('close', () => {
      state.closed += 1;
    });
    socket.on('framereceived', ({ payload }) => {
      if (typeof payload !== 'string') return;
      try {
        const frame = JSON.parse(payload);
        if (frame.type === 'subscription.ready') {
          state.ready += 1;
          flush();
        }
        if (frame.type === 'messages.updated') state.updates += 1;
        if (frame.type === 'subscription.error') {
          state.errors.push(frame.error?.message ?? 'subscription.error');
        }
      } catch {
        // Ignore normal non-subscription tRPC bridge frames.
      }
    });
  });

  return {
    label,
    state,
    waitForReady: (count, timeoutMs = 20_000) => {
      if (state.ready >= count) return Promise.resolve();
      return withTimeout(
        new Promise((resolve) => waiters.add({ count, resolve })),
        timeoutMs,
        `${label} did not receive subscription.ready #${count}`,
      );
    },
  };
};

const createPageHarness = async (browser, label, mobile) => {
  const context = await browser.newContext({
    ...(mobile ? devices['iPhone 13'] : { viewport: { height: 900, width: 1440 } }),
    ignoreHTTPSErrors: true,
    locale: 'zh-CN',
  });
  await context.addCookies([
    {
      name: COOKIE_NAME,
      secure: true,
      url: origin,
      value: cookie,
    },
  ]);

  const page = await context.newPage();
  const runtimeErrors = [];
  const blockedModelRequests = [];
  page.on('pageerror', (error) => runtimeErrors.push(`${error.name}: ${error.message}`));
  await page.route('**/*', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (
      request.method() === 'POST' &&
      (pathname.includes('/webapi/chat') || pathname.includes('/api/agent/run'))
    ) {
      blockedModelRequests.push(pathname);
      await route.fulfill({
        body: '{"error":"Model requests are disabled during realtime verification"}',
        contentType: 'application/json',
        status: 503,
      });
      return;
    }
    await route.continue();
  });

  return {
    blockedModelRequests,
    context,
    label,
    mobile,
    page,
    runtimeErrors,
    tracker: createRealtimeTracker(page, label),
  };
};

const loadConversation = async (harness, phase, expectedReadyCount) => {
  const { page, tracker } = harness;
  const startedAt = performance.now();
  const response =
    phase === 'cold'
      ? await page.goto(chatUrl, { timeout: 45_000, waitUntil: 'domcontentloaded' })
      : await page.reload({ timeout: 45_000, waitUntil: 'domcontentloaded' });

  const anchor = page.locator(MESSAGE_SELECTOR(anchorId));
  await expect(anchor).toHaveCount(1, { timeout: 45_000 });
  const anchorVisibleAt = performance.now();
  await tracker.waitForReady(expectedReadyCount);
  const subscriptionReadyAt = performance.now();

  assert(!page.url().includes('/signin'), `${harness.label} was redirected to sign-in`);
  assert.equal(harness.runtimeErrors.length, 0, `${harness.label} raised a page error`);

  return {
    anchorMs: Math.round(anchorVisibleAt - startedAt),
    responseStatus: response?.status() ?? null,
    subscriptionReadyMs: Math.round(subscriptionReadyAt - startedAt),
  };
};

const waitForContent = async (harness, content, startedAt, timeout = 20_000) => {
  const locator = harness.page.locator(MESSAGE_SELECTOR(messageId));
  await expect(locator).toHaveCount(1, { timeout });
  await expect(locator).toContainText(content, { timeout });
  return Math.round(performance.now() - startedAt);
};

const waitForRemoval = async (harness, startedAt, timeout = 20_000) => {
  await expect(harness.page.locator(MESSAGE_SELECTOR(messageId))).toHaveCount(0, { timeout });
  return Math.round(performance.now() - startedAt);
};

let browser;
let desktop;
let mobile;
let inserted = false;
let primaryError;
let cleanupError;

try {
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    headless: true,
  });
  [desktop, mobile] = await Promise.all([
    createPageHarness(browser, 'desktop', false),
    createPageHarness(browser, 'mobile', true),
  ]);

  const [desktopCold, mobileCold] = await Promise.all([
    loadConversation(desktop, 'cold', 1),
    loadConversation(mobile, 'cold', 1),
  ]);
  const [desktopWarm, mobileWarm] = await Promise.all([
    loadConversation(desktop, 'warm', 2),
    loadConversation(mobile, 'warm', 2),
  ]);

  report.pages.desktop = {
    blockedModelRequests: desktop.blockedModelRequests,
    cold: desktopCold,
    runtimeErrors: desktop.runtimeErrors,
    warm: desktopWarm,
  };
  report.pages.mobile = {
    blockedModelRequests: mobile.blockedModelRequests,
    cold: mobileCold,
    runtimeErrors: mobile.runtimeErrors,
    warm: mobileWarm,
  };

  const insertStartedAt = performance.now();
  await trpc.message.insertContextMessage.mutate({
    anchorId,
    content: insertedContent,
    editorData: null,
    fileIds: [],
    id: messageId,
    position: 'after',
    threadId: null,
  });
  inserted = true;
  const insertMutationMs = Math.round(performance.now() - insertStartedAt);
  const [desktopInsertMs, mobileInsertMs] = await Promise.all([
    waitForContent(desktop, insertedContent, insertStartedAt),
    waitForContent(mobile, insertedContent, insertStartedAt),
  ]);
  report.sync.insert = { desktopMs: desktopInsertMs, mobileMs: mobileInsertMs, mutationMs: insertMutationMs };

  const editStartedAt = performance.now();
  await trpc.message.editMessageContent.mutate({
    content: editedContent,
    editorData: null,
    fileIds: [],
    id: messageId,
  });
  const editMutationMs = Math.round(performance.now() - editStartedAt);
  const [desktopEditMs, mobileEditMs] = await Promise.all([
    waitForContent(desktop, editedContent, editStartedAt),
    waitForContent(mobile, editedContent, editStartedAt),
  ]);
  report.sync.edit = { desktopMs: desktopEditMs, mobileMs: mobileEditMs, mutationMs: editMutationMs };

  await Promise.all([
    desktop.page.locator(MESSAGE_SELECTOR(messageId)).screenshot({
      path: path.join(output, 'desktop-edited-message.png'),
    }),
    mobile.page.locator(MESSAGE_SELECTOR(messageId)).screenshot({
      path: path.join(output, 'mobile-edited-message.png'),
    }),
  ]);
} catch (error) {
  primaryError = error;
} finally {
  if (inserted) {
    report.cleanup.attempted = true;
    const removeStartedAt = performance.now();
    try {
      await trpc.message.removeMessage.mutate({
        agentId,
        groupId: null,
        id: messageId,
        sessionId: null,
        threadId: null,
        topicId,
      });
      report.cleanup.mutationMs = Math.round(performance.now() - removeStartedAt);
      if (desktop && mobile) {
        const [desktopRemoveMs, mobileRemoveMs] = await Promise.all([
          waitForRemoval(desktop, removeStartedAt),
          waitForRemoval(mobile, removeStartedAt),
        ]);
        report.sync.remove = { desktopMs: desktopRemoveMs, mobileMs: mobileRemoveMs };
      }
      report.cleanup.completed = true;
    } catch (error) {
      cleanupError = error;
      report.cleanup.error = error instanceof Error ? error.message : String(error);
    }
  }

  if (desktop) report.pages.desktop.realtime = desktop.tracker.state;
  if (mobile) report.pages.mobile.realtime = mobile.tracker.state;

  await Promise.allSettled([desktop?.context.close(), mobile?.context.close()]);
  await browser?.close();
  await writeFile(path.join(output, 'realtime-report.json'), JSON.stringify(report, null, 2));
}

if (cleanupError) throw cleanupError;
if (primaryError) throw primaryError;

assert.equal(report.cleanup.completed, true, 'Temporary message cleanup did not complete');
assert(report.pages.desktop.realtime.ready >= 2, 'Desktop subscription did not survive reload');
assert(report.pages.mobile.realtime.ready >= 2, 'Mobile subscription did not survive reload');
assert(report.pages.desktop.realtime.updates >= 3, 'Desktop did not receive all realtime updates');
assert(report.pages.mobile.realtime.updates >= 3, 'Mobile did not receive all realtime updates');
assert.equal(report.pages.desktop.realtime.errors.length, 0, 'Desktop subscription reported errors');
assert.equal(report.pages.mobile.realtime.errors.length, 0, 'Mobile subscription reported errors');
assert.equal(report.pages.desktop.blockedModelRequests.length, 0, 'Desktop attempted a model request');
assert.equal(report.pages.mobile.blockedModelRequests.length, 0, 'Mobile attempted a model request');

console.info(JSON.stringify(report, null, 2));
