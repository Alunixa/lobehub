// Browser QA against the unmodified production bundles exported by GitHub Actions.
// All API requests terminate at this local fixture server; no real account or paid API is used.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

import { chromium } from '@playwright/test';
import superjson from 'superjson';

const [previewPath, outputPath, probePath = '/image'] = process.argv.slice(2);
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
let mobile = true;

function rpc(method, input) {
  requests.push({ input, method });
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
      preference: {},
      settings: { general: { language: 'zh-CN', responseLanguage: 'zh-CN', timezone: 'Asia/Singapore' } },
      userId: user.id,
      username: user.username,
    };
  }
  if (method === 'aiProvider.getAiProviderRuntimeState') return runtime;
  if (method === 'aiProvider.getAiProviderList') return [provider];
  if (method === 'aiProvider.getAiProviderById') return { ...provider, config: {}, keyVaults: {}, settings: {} };
  if (method === 'aiModel.getAiProviderModelList') return runtime.enabledAiModels;
  if (method === 'home.getSidebarAgentList') {
    return { groups: [], pinned: [], privateGroups: [], privateUngrouped: [], ungrouped: [{ ...agent, type: 'agent' }] };
  }
  if (method === 'home.getDailyBrief') return { pairs: [] };
  if (method === 'agent.getBuiltinAgent') return { ...agent, id: `agt_builtin_${input.slug}` };
  if (method === 'agent.getAgentConfigById' || method === 'agent.getAgentById') return agent;
  if (/^agent.count|^topic.count|^message.count/.test(method)) return 1;
  if (method === 'topic.getTopics') return { items: [], total: 0 };
  if (method === 'task.list') return { data: [], total: 0 };
  if (method === 'userMemory.getPersona') return null;
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
    return { status: 'processing' };
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
    if (url.pathname.startsWith('/api/auth')) {
      return json(url.pathname.endsWith('/get-session') ? {
        session: { expiresAt: '2027-01-01T00:00:00Z', id: 'preview-session', userId: user.id },
        user,
      } : []);
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
    if (url.pathname.startsWith('/webapi') || url.pathname.startsWith('/api')) return json({});
    let file = path.resolve(preview, '.' + decodeURIComponent(url.pathname));
    if (file !== preview && !file.startsWith(preview + path.sep)) throw new Error('Invalid static path');
    if (!path.extname(file)) file = path.join(preview, mobile ? 'mobile.html' : 'desktop.html');
    let data = await readFile(file);
    if (file.endsWith('.html')) {
      data = Buffer.from(data.toString().replace(
        /window\.__SERVER_CONFIG__\s*=\s*undefined;/,
        `window.__SERVER_CONFIG__=${JSON.stringify({ config, featureFlags: flags, isMobile: mobile })};`,
      ));
    }
    res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' });
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
  page.on('pageerror', (error) => errors.push(error.stack));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const pages = [];
  for (const [index, route] of probePath.split(',').entries()) {
    await page.goto(origin + route, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.body.innerText.trim().length > 20);
    if (/^\/agent\/[^/?]+$/.test(route)) {
      await page.locator('[contenteditable="true"]').first().waitFor({ timeout: 15000 })
        .catch((error) => errors.push(error.message));
    }
    await page.screenshot({ path: path.join(output, `probe-${index}.png`) });
    pages.push({
      errors: [...errors],
      text: await page.locator('body').innerText(),
      url: page.url(),
    });
    errors.length = 0;
  }
  const report = { createCount, pages, requests, unknown: [...unknown] };
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
