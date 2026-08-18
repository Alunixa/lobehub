import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

import { createHostExecutorServer } from './server.mjs';

const token = 'test-token-that-is-longer-than-thirty-two-characters';
const root = await mkdtemp(path.join(os.tmpdir(), 'lobe-host-executor-test-'));
const { server } = createHostExecutorServer({ host: '127.0.0.1', port: 0, root, token });
let baseUrl;

before(async () => {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(root, { force: true, recursive: true });
});

const call = async (toolName, params) => {
  const response = await fetch(`${baseUrl}/v1/tools/call`, {
    body: JSON.stringify({ params, toolName, topicId: 'topic-1', userId: 'user-1' }),
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    method: 'POST',
  });
  assert.equal(response.status, 200);
  return response.json();
};

test('rejects unauthenticated execution', async () => {
  const response = await fetch(`${baseUrl}/v1/tools/call`, { method: 'POST' });
  assert.equal(response.status, 401);
});

test('executes commands in the native host workspace', async () => {
  const script = path.join(root, 'foreground.cjs');
  await writeFile(
    script,
    "const fs=require('fs');console.log(process.cwd());fs.writeFileSync('marker.txt','host-ok')",
  );
  const result = await call('runCommand', {
    command: `node "${script}"`,
  });
  assert.equal(result.success, true);
  assert.equal(result.result.exitCode, 0, JSON.stringify(result));
  assert.match(result.result.stdout, /workspaces/);

  const marker = path.join(root, 'workspaces', 'user-1', 'topic-1', 'marker.txt');
  assert.equal(await readFile(marker, 'utf8'), 'host-ok');
});

test('maps the cloud /mnt/data path to the host workspace', async () => {
  const write = await call('writeLocalFile', { content: 'mapped', path: '/mnt/data/data.txt' });
  assert.equal(write.success, true);

  const read = await call('readLocalFile', { path: '/mnt/data/data.txt' });
  assert.equal(read.result.content, 'mapped');
});

test('supports background command polling', async () => {
  const start = await call('runCommand', {
    background: true,
    command: 'echo background-ok',
  });
  assert.equal(start.success, true);

  let output;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    output = await call('getCommandOutput', { commandId: start.result.commandId });
    if (!output.result.running) break;
  }
  assert.equal(output.result.running, false);
  assert.match(output.result.stdout, /background-ok/, JSON.stringify(output));
});
