// Browser QA against the unmodified production bundles exported by GitHub Actions.
// All API requests terminate at this local fixture server; no real account or paid API is used.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

import { chromium, expect } from '@playwright/test';
import superjson from 'superjson';

const [previewPath, outputPath, probePath = '/image'] = process.argv.slice(2);
const conversationFixture = probePath.startsWith('--conversation');
const verifyConversation = conversationFixture && !probePath.endsWith('probe');
const groupedReply = probePath.includes('grouped');
const verifyCurrentTime = probePath === '--current-time';
let timePreference = false;
assert(previewPath && outputPath, 'Usage: node verify-preview.mjs PREVIEW_DIR OUTPUT_DIR [PATH]');
const preview = path.resolve(previewPath);
const output = path.resolve(outputPath);
await mkdir(output, { recursive: true });
const now = new Date('2026-09-06T04:00:00.000Z');
const user = {
  createdAt: now.toISOString(),
  email: 'preview@example.test',
  emailVerified: true,
  id: 'preview-user',
  name: '界面验证',
  updatedAt: now.toISOString(),
  username: 'preview',
};
const agent = {
  chatConfig: {},
  createdAt: now,
  description: '用于验证手机页面的本地演示助手',
  id: 'agt_preview',
  meta: { avatar: '🤖', description: '本地演示助手', title: '创作助手' },
  model: 'gpt-4o',
  params: {},
  plugins: [],
  provider: 'openai',
  systemRole: 'You are a helpful assistant.',
  title: '创作助手',
  updatedAt: now,
};
const provider = { enabled: true, id: 'openai', name: 'OpenAI', source: 'builtin' };
const config = {
  aiProvider: {},
  defaultAgent: { config: agent },
  enableBusinessFeatures: false,
  image: {},
  telemetry: {},
};
const flags = { enableImageGeneration: true, showCloudPromotion: false, showMarket: true };
const runtime = {
  enabledAiModels: [
    {
      abilities: { functionCall: true, vision: true },
      enabled: true,
      id: 'gpt-4o',
      providerId: 'openai',
      type: 'chat',
    },
    {
      abilities: { imageOutput: true },
      enabled: true,
      id: 'gpt-image-1',
      parameters: {
        size: {
          allowCustom: true,
          default: '1024x1024',
          enum: ['1024x1024', '1536x1024', '1024x1536'],
          max: 4096,
          min: 64,
          step: 64,
        },
      },
      providerId: 'openai',
      type: 'image',
    },
  ],
  enabledAiProviders: [provider],
  enabledChatAiProviders: [provider],
  enabledImageAiProviders: [provider],
  enabledVideoAiProviders: [],
  runtimeConfig: { openai: { enabled: true, keyVaults: {}, settings: {} } },
};
const requests = [];
const unknown = new Set();
const topics = [
  {
    createdAt: now,
    creator: { id: user.id, username: user.username },
    id: 'preview-topic',
    title: '海边创作练习',
    updatedAt: now,
    visibility: 'private',
  },
];
const batches = {};
let createCount = 0;
let fileCount = 0;
let generationPhase = 'processing';
let mobile = true;

function rpc(method, input) {
  requests.push({ input, method });
  if (verifyCurrentTime && method === 'user.updateSettings') {
    if (typeof input?.general?.injectCurrentTime === 'boolean') {
      timePreference = input.general.injectCurrentTime;
    }
    return {};
  }
  if (method === 'config.getGlobalConfig') {
    return { serverConfig: config, serverFeatureFlags: flags };
  }
  if (method === 'user.getUserState') {
    return {
      canEnablePWAGuide: false,
      email: user.email,
      fullName: user.name,
      hasConversation: true,
      isOnboard: true,
      onboarding: { finishedAt: now.toISOString() },
      preference: { useCmdEnterToSend: false },
      settings: {
        general: {
          injectCurrentTime: timePreference,
          isDevMode: conversationFixture,
          contextMenuMode: 'default',
          language: 'zh-CN',
          responseLanguage: 'zh-CN',
          timezone: 'Asia/Singapore',
        },
      },
      userId: user.id,
      username: user.username,
    };
  }
  if (method === 'aiProvider.getAiProviderRuntimeState') return runtime;
  if (method === 'aiProvider.getAiProviderList') return [provider];
  if (method === 'aiProvider.getAiProviderById')
    return { ...provider, config: {}, keyVaults: {}, settings: {} };
  if (method === 'aiModel.getAiProviderModelList') return runtime.enabledAiModels;
  if (method === 'home.getSidebarAgentList') {
    return {
      groups: [],
      pinned: [],
      privateGroups: [],
      privateUngrouped: [],
      ungrouped: [{ ...agent, type: 'agent' }],
    };
  }
  if (method === 'home.getDailyBrief') return { pairs: [] };
  if (method === 'agent.getBuiltinAgent') return { ...agent, id: `agt_builtin_${input.slug}` };
  if (method === 'agent.getAgentConfigById' || method === 'agent.getAgentById') return agent;
  if (/^agent.count|^topic.count|^message.count/.test(method)) return 1;
  if (conversationFixture) {
    const chatTopics = Array.from({ length: 65 }, (_, index) => ({
      agentId: agent.id,
      createdAt: now,
      favorite: false,
      id: `tpc_preview_${index}`,
      title: `图片回归对话 ${String(index + 1).padStart(2, '0')}`,
      updatedAt: now,
    }));
    if (method === 'topic.getTopics') {
      const size = input.pageSize || 20;
      return {
        items: chatTopics.slice((input.current || 0) * size, ((input.current || 0) + 1) * size),
        total: chatTopics.length,
      };
    }
    if (method === 'topic.searchTopics')
      return chatTopics.filter((topic) => topic.title.includes(input.keywords));
    if (method === 'topic.getTopic')
      return chatTopics.find((topic) => topic.id === (input.id || input));
    if (method === 'thread.getThreads') return [];
    if (method === 'message.getMessages') {
      if (!input.topicId) return [];
      return [
        {
          agentId: agent.id,
          content: '用户参考图片',
          createdAt: now.getTime(),
          id: 'msg_user',
          imageList: [
            {
              id: 'file_user',
              alt: 'user-reference',
              url: `${origin}/fixture.svg?user`,
              width: 1024,
              height: 768,
            },
          ],
          role: 'user',
          topicId: input.topicId,
          updatedAt: now.getTime(),
        },
        {
          ...(groupedReply
            ? {
                agentId: agent.id,
                content: '准备生成图片',
                createdAt: now.getTime() + 1,
                id: 'msg_prepare',
                model: 'gpt-4o',
                parentId: 'msg_user',
                provider: 'openai',
                role: 'assistant',
                tools: [
                  {
                    id: 'tool_image',
                    apiName: 'generateImage',
                    arguments: '{}',
                    identifier: 'image-fixture',
                    type: 'default',
                    result_msg_id: 'msg_tool',
                  },
                ],
                topicId: input.topicId,
                updatedAt: now.getTime() + 1,
              }
            : {
                agentId: agent.id,
                content: '助手生成图片',
                createdAt: now.getTime() + 1,
                id: 'msg_assistant',
                imageList: [
                  {
                    id: 'file_assistant',
                    alt: 'assistant-image',
                    url: `${origin}/fixture.svg?assistant`,
                    width: 1024,
                    height: 768,
                  },
                ],
                model: 'gpt-4o',
                parentId: 'msg_user',
                provider: 'openai',
                role: 'assistant',
                topicId: input.topicId,
                updatedAt: now.getTime() + 1,
              }),
        },
        ...(groupedReply
          ? [
              {
                agentId: agent.id,
                content: 'Image ready',
                createdAt: now.getTime() + 2,
                id: 'msg_tool',
                parentId: 'msg_prepare',
                plugin: {
                  apiName: 'generateImage',
                  identifier: 'image-fixture',
                  arguments: '{}',
                  type: 'default',
                },
                tool_call_id: 'tool_image',
                role: 'tool',
                topicId: input.topicId,
                updatedAt: now.getTime() + 2,
              },
              {
                agentId: agent.id,
                content: '助手生成图片',
                createdAt: now.getTime() + 1,
                id: 'msg_assistant',
                imageList: [
                  {
                    id: 'file_assistant',
                    alt: 'assistant-image',
                    url: `${origin}/fixture.svg?assistant`,
                    width: 1024,
                    height: 768,
                  },
                ],
                model: 'gpt-4o',
                parentId: 'msg_prepare',
                provider: 'openai',
                role: 'assistant',
                topicId: input.topicId,
                updatedAt: now.getTime() + 3,
              },
            ]
          : []),
      ];
    }
  }
  if (method === 'topic.getTopics') return { items: [], total: 0 };
  if (method === 'task.list') return { data: [], total: 0 };
  if (method === 'userMemory.getPersona') return null;
  if (method === 'file.checkFileHash') {
    return { isExist: true, metadata: { path: '/fixture.svg' }, url: '/fixture.svg' };
  }
  if (method === 'file.createFile') {
    fileCount += 1;
    return { id: `preview-file-${fileCount}`, url: `${origin}/fixture.svg?id=${fileCount}` };
  }
  if (method === 'generationTopic.getAllGenerationTopics') return topics;
  if (method === 'generationTopic.createTopic') {
    const id = `preview-created-${topics.length}`;
    topics.unshift({ ...topics[0], createdAt: new Date(), id, title: '新的创作' });
    return id;
  }
  if (method === 'generationTopic.updateTopic') {
    const topic = topics.find((item) => item.id === input.id);
    if (topic) Object.assign(topic, input.value);
    return topic;
  }
  if (method === 'generationBatch.getGenerationBatches') return batches[input.topicId] || [];
  if (method === 'image.createImage') {
    createCount += 1;
    const id = `preview-batch-${createCount}`;
    const batch = {
      config: input.params,
      createdAt: new Date(),
      generationTopicId: input.generationTopicId,
      height: 1024,
      id,
      model: input.model,
      prompt: input.params.prompt,
      provider: input.provider,
      width: 1024,
    };
    const generations = Array.from({ length: input.imageNum }, (_, index) => ({
      asyncTaskId: `${id}-task-${index}`,
      createdAt: new Date(),
      id: `${id}-image-${index}`,
      task: { id: `${id}-task-${index}`, status: 'pending' },
    }));
    batches[input.generationTopicId] = [
      { ...batch, generations },
      ...(batches[input.generationTopicId] || []),
    ];
    return { data: { batch, generations }, success: true };
  }
  if (method === 'generation.getGenerationStatus') {
    const generation = Object.values(batches)
      .flat()
      .flatMap((batch) => batch.generations)
      .find((item) => item.id === input.generationId);
    if (generation && generationPhase !== 'processing') {
      generation.task.status = generationPhase;
      if (generationPhase === 'success') {
        generation.asset = {
          height: 768,
          thumbnailUrl: `${origin}/fixture.svg`,
          type: 'image',
          url: `${origin}/fixture.svg`,
          width: 1024,
        };
      } else {
        generation.task.error = { body: 'Preview generation failed', name: 'ServerError' };
      }
    }
    return { error: generation?.task.error || null, generation, status: generationPhase };
  }
  if (/update|toggle|mark|setPreference/.test(method)) return {};
  unknown.add(method);
  return [];
}

const mime = {
  '.css': 'text/css',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const json = (data) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    if (url.pathname === '/fixture.svg') {
      res.writeHead(200, { 'content-type': 'image/svg+xml' });
      return res.end(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768"><rect width="1024" height="768" fill="#b8d9e8"/><circle cx="760" cy="180" r="90" fill="#ffe4a3"/><path d="M0 580 250 260 620 768H0Z" fill="#56848a"/><path d="M290 768 710 380 1024 650V768Z" fill="#32646f"/><text x="60" y="700" fill="white" font-size="40">Local UI fixture</text></svg>',
      );
    }
    if (url.pathname.startsWith('/api/auth')) {
      return json(
        url.pathname.endsWith('/get-session')
          ? {
              session: {
                expiresAt: '2027-01-01T00:00:00Z',
                id: 'preview-session',
                userId: user.id,
              },
              user,
            }
          : [],
      );
    }
    if (url.pathname.startsWith('/trpc/')) {
      const names = decodeURIComponent(url.pathname.split('/').at(-1)).split(',');
      let body = '';
      for await (const part of req) body += part;
      const encodedInput = JSON.parse(body || url.searchParams.get('input') || '{}');
      const batch = url.searchParams.has('batch');
      const results = names.map((name, index) => {
        const encoded = batch ? encodedInput[index] : encodedInput;
        const input = encoded?.json === undefined ? undefined : superjson.deserialize(encoded);
        return { result: { data: superjson.serialize(rpc(name, input)) } };
      });
      return json(batch ? results : results[0]);
    }
    if (url.pathname.startsWith('/webapi') || url.pathname.startsWith('/api')) {
      requests.push({ method: `${req.method} ${url.pathname}` });
      if (url.pathname.includes('/chat/')) {
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
        return res.end('海边创作练习');
      }
      return json({});
    }
    let file = path.resolve(preview, '.' + decodeURIComponent(url.pathname));
    if (file !== preview && !file.startsWith(preview + path.sep))
      throw new Error('Invalid static path');
    if (!path.extname(file)) file = path.join(preview, mobile ? 'mobile.html' : 'desktop.html');
    let data = await readFile(file);
    if (file.endsWith('.html')) {
      data = Buffer.from(
        data
          .toString()
          .replace(
            /window\.__SERVER_CONFIG__\s*=\s*undefined;/,
            `window.__SERVER_CONFIG__=${JSON.stringify({ config, featureFlags: flags, isMobile: mobile })};`,
          ),
      );
    }
    res.writeHead(200, {
      'content-type': mime[path.extname(file)] || 'application/octet-stream',
    });
    res.end(data);
  } catch (error) {
    res.writeHead(404);
    res.end(String(error));
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  headless: true,
});
const errors = [];
const runtimeErrors = [];
const pages = [];
const assertions = [];
try {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    locale: 'zh-CN',
    viewport: { height: 844, width: 390 },
  });
  await context.route('**/*', (route) => {
    if (route.request().url().startsWith(origin) || route.request().url().startsWith('data:')) {
      return route.continue();
    }
    if (route.request().resourceType() === 'stylesheet') {
      return route.fulfill({ body: '', contentType: 'text/css' });
    }
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => {
    errors.push(error.stack);
    runtimeErrors.push(error.stack);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const capture = async (label) => {
    const bounds = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      viewportHeight: visualViewport?.height || innerHeight,
    }));
    const text = await page.locator('body').innerText();
    await page.screenshot({ path: path.join(output, `${label}.png`) });
    pages.push({ bounds, errors: [...errors], label, text, url: page.url() });
    errors.length = 0;
    assert(bounds.scrollWidth <= bounds.clientWidth + 1, `${label}: horizontal overflow`);
    assert(!text.includes('页面暂时不可用'), `${label}: route error boundary`);
    assert(!text.includes('页面不存在'), `${label}: route not found`);
  };
  const open = async (route) => {
    await page.goto(origin + route, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.body.innerText.trim().length > 20);
    if (/^\/agent\/[^/?]+$/.test(route)) {
      await page.locator('[contenteditable="true"]').first().waitFor({ timeout: 15000 });
    }
    if (mobile && probePath !== '--conversation-probe') {
      const editing = await page.evaluate(() =>
        document.activeElement?.matches('input,textarea,[contenteditable="true"]'),
      );
      if (editing) {
        await writeFile(
          path.join(output, 'unexpected-focus.json'),
          JSON.stringify(
            await page.evaluate(() => ({
              active: document.activeElement?.outerHTML,
              body: document.body.innerText,
              route: location.pathname,
            })),
            null,
            2,
          ),
        );
        await page.screenshot({ path: path.join(output, 'unexpected-focus.png') });
      }
      assert(!editing, `${route}: navigation must not autofocus a mobile input`);
    }
  };
  if (verifyCurrentTime) {
    for (const desktop of [false, true]) {
      mobile = !desktop;
      timePreference = false;
      await page.setViewportSize(
        desktop ? { width: 1440, height: 900 } : { width: 390, height: 844 },
      );
      await open('/settings/appearance');
      const toggle = page.getByRole('switch', { name: '每次 AI 请求附带当前日期和时间' });
      await expect(toggle).toBeVisible();
      await expect(toggle).not.toBeChecked();
      await toggle.click();
      await expect(toggle).toBeChecked();
      await expect.poll(() => timePreference).toBe(true);
      await open('/settings/appearance');
      await expect(toggle).toBeChecked();
      await expect(page.getByText(/使用时区 Asia\/Singapore/)).toBeVisible();
      await capture(desktop ? 'current-time-desktop-on' : 'current-time-mobile-on');
      await toggle.click();
      await expect.poll(() => timePreference).toBe(false);
      await open('/settings/appearance');
      await expect(toggle).not.toBeChecked();
      await capture(desktop ? 'current-time-desktop-off' : 'current-time-mobile-off');
    }
    assert.equal(runtimeErrors.length, 0);
    assertions.push(
      'Current-time switch defaults off, persists on/off after reload on mobile and desktop, and shows the timezone',
    );
  } else if (conversationFixture) {
    await open('/agent/agt_preview/tpc_preview_0');
    await capture('conversation-initial');
    await writeFile(
      path.join(output, 'conversation-dom.json'),
      JSON.stringify(
        {
          buttons: await page.getByRole('button').evaluateAll((items) =>
            items.map((item) => ({
              label: item.getAttribute('aria-label'),
              text: item.textContent,
              title: item.getAttribute('title'),
            })),
          ),
          images: await page
            .locator('img')
            .evaluateAll((items) => items.map((item) => ({ src: item.src, alt: item.alt }))),
        },
        null,
        2,
      ),
    );
    await page.getByRole('button', { name: '查看历史对话' }).click();
    await page.getByRole('dialog').waitFor();
    await capture('mobile-history');
    const mobileFocus = await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      placeholder: document.activeElement?.getAttribute('placeholder'),
    }));
    await writeFile(path.join(output, 'mobile-focus.json'), JSON.stringify(mobileFocus));
    if (verifyConversation) {
      assert.notEqual(mobileFocus.tag, 'INPUT', 'Opening history must not focus search');
      const dialog = page.getByRole('dialog');
      const search = dialog.getByPlaceholder('搜索话题…');
      await search.tap();
      await expect(search).toBeFocused();
      await search.fill('65');
      await expect(dialog.getByText('图片回归对话 65', { exact: true })).toBeVisible();
      await search.fill('');
      await expect(dialog.getByText('图片回归对话 01', { exact: true })).toBeVisible();
      const scroller = dialog.locator('[style*="contain: strict"]');
      const box = await scroller.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      for (let index = 0; index < 12; index += 1) {
        if (await dialog.getByText('图片回归对话 65', { exact: true }).isVisible()) break;
        await page.mouse.wheel(0, 1500);
        await page.waitForTimeout(200);
      }
      await writeFile(
        path.join(output, 'history-scroll.json'),
        JSON.stringify(
          await dialog.locator('*').evaluateAll((elements) =>
            elements
              .filter((element) => element.scrollHeight > element.clientHeight + 5)
              .map((element) => ({
                className: element.className,
                style: element.getAttribute('style'),
                overflow: getComputedStyle(element).overflowY,
                clientHeight: element.clientHeight,
                scrollHeight: element.scrollHeight,
                scrollTop: element.scrollTop,
                box: element.getBoundingClientRect().toJSON(),
              })),
          ),
          null,
          2,
        ),
      );
      await expect(dialog.getByText('图片回归对话 65', { exact: true })).toBeVisible();
      assert(
        requests.some(({ method, input }) => method === 'topic.getTopics' && input.current > 0),
      );
      await capture('mobile-full-history-65');
      await dialog.getByText('图片回归对话 65', { exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await expect(page.locator('[contenteditable="true"]').first()).not.toBeFocused();
      const url = page.url();
      const editor = page.locator('[contenteditable="true"]').first();
      await editor.tap();
      await editor.fill('第一行');
      await editor.press('Shift+Enter');
      await editor.pressSequentially('第二行');
      await expect(editor).toContainText('第一行');
      await expect(editor).toContainText('第二行');
      assert.equal(page.url(), url);
      assertions.push(
        'Mobile history has all 65 paginated topics and live search; keyboard focus requires direct input tap',
      );
    }
    await page.keyboard.press('Escape');
    mobile = false;
    await page.setViewportSize({ width: 1440, height: 900 });
    await open('/agent/agt_preview/tpc_preview_0');
    await page.getByText('助手生成图片', { exact: true }).click({ button: 'right' });
    await capture('desktop-context-menu');
    await writeFile(path.join(output, 'desktop-menu.txt'), await page.locator('body').innerText());
    if (conversationFixture) {
      const branch = page.getByRole('menuitem', { name: /创建子话题/ });
      if (await branch.count()) {
        await branch.click();
        await capture('desktop-thread');
        await writeFile(
          path.join(output, 'thread-dom.json'),
          JSON.stringify(
            {
              buttons: await page.getByRole('button').evaluateAll((items) =>
                items.map((item) => ({
                  label: item.getAttribute('aria-label'),
                  text: item.textContent,
                  title: item.getAttribute('title'),
                })),
              ),
              images: await page
                .locator('img')
                .evaluateAll((items) => items.map((item) => ({ src: item.src, alt: item.alt }))),
              panels: await page.locator('[class*="draggable"]').evaluateAll((items) =>
                items.map((item) => ({
                  class: item.className,
                  rect: item.getBoundingClientRect().toJSON(),
                })),
              ),
            },
            null,
            2,
          ),
        );
        if (verifyConversation) {
          const panel = page
            .locator('.ant-draggable-panel')
            .filter({ has: page.getByText('开启新的子话题', { exact: true }) })
            .last();
          const close = panel.getByRole('button', { name: '关闭', exact: true });
          await expect(close).toBeVisible();
          const closeBox = await close.boundingBox();
          assert(closeBox.x + closeBox.width <= 1440, 'Thread close button must be on screen');
          await expect(panel.locator('img[alt="assistant-image"]')).toBeVisible();
          await expect(panel.locator('img[alt="user-reference"]')).toBeVisible();
          const widthBefore = (await panel.boundingBox()).width;
          const handle = panel.locator('[class*="-left-handle"]').first();
          const handleBox = await handle.boundingBox();
          await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + 100);
          await page.mouse.down();
          await page.mouse.move(handleBox.x - 130, handleBox.y + 100, { steps: 12 });
          await page.mouse.up();
          await expect
            .poll(async () => (await panel.boundingBox()).width)
            .toBeGreaterThan(widthBefore + 60);
          await capture('desktop-thread-resized');
          const editor = panel.locator('[contenteditable="true"]');
          const url = page.url();
          const writesBefore = requests.filter(({ method }) =>
            /createMessage|execAgent|sendMessage/.test(method),
          ).length;
          await editor.click();
          await editor.fill('第一行');
          await editor.press('Shift+Enter');
          await editor.pressSequentially('第二行');
          await expect(editor).toContainText('第一行');
          await expect(editor).toContainText('第二行');
          assert.equal(page.url(), url);
          assert.equal(
            requests.filter(({ method }) => /createMessage|execAgent|sendMessage/.test(method))
              .length,
            writesBefore,
          );
          await panel.getByRole('switch').click();
          await expect(panel.locator('img[alt="user-reference"]')).toHaveCount(0);
          await expect(panel.locator('img[alt="assistant-image"]')).toBeVisible();
          await panel.getByRole('switch').click();
          await expect(panel.locator('img[alt="user-reference"]')).toBeVisible();
          await close.click();
          await expect(page.getByText('开启新的子话题', { exact: true })).not.toBeVisible();
          await expect(page.locator('[contenteditable="true"]:visible')).toHaveCount(1);
          assertions.push(
            'Thread images, context toggle, resize, close and Shift+Enter pass on the real desktop bundle',
          );
          await capture('desktop-thread-closed');
        }
      } else if (verifyConversation) {
        assert.fail('Create subtopic action missing');
      }
    }
  } else if (probePath === '--matrix') {
    const routes = [
      '/',
      '/tools',
      '/me',
      '/settings',
      '/settings/appearance',
      '/settings/provider/all',
      '/settings/provider/openai',
      '/settings/profile',
      '/settings/security',
      '/settings/service-model',
      '/settings/memory',
      '/settings/devices',
      '/settings/advanced',
      '/agent/agt_preview',
      '/agent/agt_preview/settings',
      '/agent/agt_preview/settings?section=params',
      '/agent/agt_preview/profile',
      '/community',
      '/tasks',
      '/image',
    ];
    for (const [index, route] of routes.entries()) {
      await open(route);
      await capture(`mobile-390-${index}`);
      if (route === '/tasks') {
        const taskEditor = page.locator('[contenteditable="true"]').first();
        await expect(taskEditor).not.toBeFocused();
        await taskEditor.tap();
        await expect(taskEditor).toBeFocused();
        await taskEditor.fill('任务输入第一行');
        await taskEditor.press('Shift+Enter');
        await taskEditor.pressSequentially('第二行');
        await expect(taskEditor).toContainText('第二行');
        await expect(taskEditor).toBeFocused();
        assert.equal(new URL(page.url()).pathname, '/tasks');
        await page.getByText('今天想搞定点什么？', { exact: true }).tap();
        await expect(taskEditor).not.toBeFocused();
        await page.reload({ waitUntil: 'networkidle' });
        await expect(taskEditor).toContainText('第二行');
        await expect(taskEditor).not.toBeFocused();
        assertions.push(
          'Task editor requires a tap, retains multiline input and reloads drafts without autofocus',
        );
      }
    }
    for (const [width, height] of [
      [320, 568],
      [360, 800],
      [430, 932],
      [768, 1024],
      [844, 390],
      [390, 430],
    ]) {
      await page.setViewportSize({ height, width });
      for (const [index, route] of ['/image', '/agent/agt_preview', '/settings'].entries()) {
        await open(route);
        await capture(`mobile-${width}x${height}-${index}`);
        if (route === '/image') {
          const footer = page.getByRole('button', { name: /生成 \d+ 张图片/ });
          const box = await footer.boundingBox();
          assert(
            box && box.y + box.height <= height + 1,
            `Submit button outside ${width}x${height}`,
          );
        }
      }
    }
    await page.setViewportSize({ height: 844, width: 390 });
    await open('/agent/agt_preview');
    const editor = page.locator('[contenteditable="true"]').first();
    const chatRequests = () =>
      requests.filter(({ method }) =>
        /send|createMessage|execAgent|aiAgent|POST .*\/chat\//.test(method),
      ).length;
    const before = chatRequests();
    await editor.tap();
    await editor.fill('第一行');
    await editor.press('Enter');
    await editor.pressSequentially('第二行');
    await expect(editor).toContainText('第一行');
    await expect(editor).toContainText('第二行');
    assert.equal(chatRequests(), before);
    assertions.push('Mobile Enter inserts a newline without sending');
    await capture('mobile-chat-keyboard');
    await editor.fill('');

    await open('/image');
    await expect(page.locator('#image-studio-prompt')).toBeEnabled();
    const fixturePng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
      'base64',
    );
    await page
      .locator('input[type=file][multiple]')
      .first()
      .setInputFiles([
        { buffer: fixturePng, mimeType: 'image/png', name: 'reference-1.png' },
        { buffer: fixturePng, mimeType: 'image/png', name: 'reference-2.png' },
      ]);
    await expect.poll(() => fileCount).toBe(2);
    await page.getByRole('button', { name: '自定义', exact: true }).click();
    const widthInput = page.getByRole('spinbutton', { name: '宽度', exact: true });
    const heightInput = page.getByRole('spinbutton', { name: '高度', exact: true });
    await expect(widthInput).not.toBeFocused();
    await widthInput.tap();
    await widthInput.fill('1280');
    await heightInput.tap();
    await heightInput.fill('768');
    await page.getByRole('button', { name: '确认', exact: true }).click();
    await page.locator('#image-studio-prompt').tap();
    await page.locator('#image-studio-prompt').fill('海边山峦与落日，宽画幅');
    await capture('mobile-image-references-size');
    const submit = page.getByRole('button', { name: /生成 \d+ 张图片/ });
    await submit.click();
    await expect.poll(() => createCount).toBe(1);
    await expect(page.getByTestId('studio-results')).toBeVisible();
    await expect(page.getByTestId('studio-results')).toContainText('海边山峦与落日');
    const submitted = requests.find(({ method }) => method === 'image.createImage').input;
    assert.equal(submitted.params.imageUrls.length, 2);
    assert.equal(submitted.params.size, '1280x768');
    assertions.push('Two file references and custom dimensions reach the request unchanged');
    await capture('mobile-image-pending');
    generationPhase = 'success';
    await expect(page.getByTestId('studio-results')).toContainText('2 张完成 · 0 张生成中', {
      timeout: 15000,
    });
    await capture('mobile-image-success');
    const completedUrl = page.url();
    await page.getByRole('tab', { name: '历史', exact: true }).click();
    await capture('mobile-image-history');
    await open(new URL(completedUrl).pathname + new URL(completedUrl).search);
    await expect(page.getByTestId('studio-results')).toContainText('2 张完成 · 0 张生成中');
    assert.equal(createCount, 1);
    assertions.push(
      'Accepted tasks, completed images, history and URL reload remain visible without another paid request',
    );

    await page.getByRole('button', { name: '新建项目', exact: true }).click();
    await expect(page.locator('#image-studio-prompt')).not.toBeFocused();
    await page.locator('#image-studio-prompt').tap();
    await page.locator('#image-studio-prompt').fill('错误反馈验证');
    generationPhase = 'error';
    await page.getByRole('button', { name: /生成 \d+ 张图片/ }).click();
    await expect(page.getByTestId('studio-results')).toContainText('生成遇到了问题');
    await capture('mobile-image-error');
    assertions.push('Failed generation is visible and actionable');
    mobile = false;
    for (const [width, height] of [
      [1024, 768],
      [1440, 900],
      [1920, 1080],
    ]) {
      await page.setViewportSize({ height, width });
      await open('/image?topic=' + submitted.generationTopicId);
      await expect(page.getByTestId('studio-results')).toBeVisible();
      await expect(page.getByTestId('studio-composer')).toBeVisible();
      await capture(`desktop-image-${width}`);
    }
    assert.equal(runtimeErrors.length, 0, 'Unexpected browser runtime errors');
  } else {
    for (const [index, route] of probePath.split(',').entries()) {
      await open(route);
      await capture(`probe-${index}`);
    }
  }
  assertions.push('All captured pages fit the viewport without a route error');
} finally {
  const report = {
    assertions,
    createCount,
    fileCount,
    pages,
    requests,
    runtimeErrors,
    unknown: [...unknown],
  };
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.info(
    JSON.stringify(
      {
        assertions,
        createCount,
        fileCount,
        pages: pages.map(({ bounds, label, text }) => ({
          bounds,
          label,
          text: text.slice(0, 120),
        })),
        runtimeErrors,
        unknown: [...unknown],
      },
      null,
      2,
    ),
  );
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
