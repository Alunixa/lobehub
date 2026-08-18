import { execFile, spawn } from 'node:child_process';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_BODY_BYTES = 16 * 1024 * 1024;

const json = (response, status, body) => {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Length': Buffer.byteLength(payload),
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(payload);
};

const safeSegment = (value) => String(value || 'anonymous').replaceAll(/[^\w.-]/g, '-');
const shellQuote = (value) => `'${String(value).replaceAll("'", String.raw`'\''`)}'`;
const errorResult = (message, name) => ({
  error: { message: String(message), ...(name ? { name } : {}) },
  result: null,
  success: false,
});
const okResult = (result) => ({ result, success: true });

const readBody = async (request) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('Request body is too large');
    chunks.push(chunk);
  }
  return chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const isAuthorized = (request, token) => {
  const header = request.headers.authorization || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  const left = Buffer.from(provided);
  const right = Buffer.from(token);
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
};

const normalizeConfig = (overrides = {}) => {
  const token = overrides.token ?? process.env.HOST_EXECUTOR_TOKEN ?? '';
  if (token.length < 32) throw new Error('HOST_EXECUTOR_TOKEN must contain at least 32 characters');

  return {
    host: overrides.host ?? process.env.HOST_EXECUTOR_HOST ?? '127.0.0.1',
    maxOutputBytes: Number(
      overrides.maxOutputBytes ??
        process.env.HOST_EXECUTOR_MAX_OUTPUT_BYTES ??
        DEFAULT_MAX_OUTPUT_BYTES,
    ),
    port: Number(overrides.port ?? process.env.HOST_EXECUTOR_PORT ?? 3211),
    root: path.resolve(
      overrides.root ?? process.env.HOST_EXECUTOR_ROOT ?? '/var/lib/lobehub-host-executor',
    ),
    token,
  };
};

const workspaceFor = (config, body) => {
  const workspace = path.join(
    config.root,
    'workspaces',
    safeSegment(body.userId),
    safeSegment(body.topicId),
  );
  mkdirSync(workspace, { recursive: true, mode: 0o700 });
  return workspace;
};

const resolveHostPath = (workspace, value = '.') => {
  const input = String(value || '.');
  if (input === '/mnt/data') return workspace;
  if (input.startsWith('/mnt/data/')) return path.join(workspace, input.slice('/mnt/data/'.length));
  return path.isAbsolute(input) ? input : path.resolve(workspace, input);
};

const translateCommandPaths = (workspace, command) =>
  String(command).replaceAll('/mnt/data', workspace);

const numeric = (value, fallback) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const shellInvocation = (command) =>
  process.platform === 'win32'
    ? { args: ['/d', '/c', command], executable: process.env.ComSpec || 'cmd.exe' }
    : { args: ['-lc', command], executable: '/bin/sh' };

const runForeground = (command, cwd, timeout, maxOutputBytes) => {
  const shell = shellInvocation(command);
  return new Promise((resolve) => {
    execFile(
      shell.executable,
      shell.args,
      {
        cwd,
        maxBuffer: maxOutputBytes,
        timeout,
        windowsVerbatimArguments: process.platform === 'win32',
      },
      (error, stdout = '', stderr = '') => {
        const exitCode = typeof error?.code === 'number' ? error.code : error ? 1 : 0;
        resolve({
          error: error && exitCode === 1 && !stderr ? error.message : undefined,
          exitCode,
          output: `${stdout}${stderr}`,
          stderr,
          stdout,
          success: exitCode === 0,
        });
      },
    );
  });
};

const readTail = (filePath, maxBytes) => {
  if (!existsSync(filePath)) return '';
  const value = readFileSync(filePath);
  return value.subarray(Math.max(0, value.length - maxBytes)).toString('utf8');
};

const createSessionManager = (config) => {
  const sessions = new Map();
  const sessionRoot = path.join(config.root, 'sessions');
  mkdirSync(sessionRoot, { recursive: true, mode: 0o700 });

  return {
    get(commandId) {
      return sessions.get(commandId);
    },
    kill(commandId) {
      const session = sessions.get(commandId);
      if (!session) return { error: `Command ID ${commandId} not found`, success: false };
      try {
        if (session.child.pid && process.platform !== 'win32') {
          process.kill(-session.child.pid, 'SIGKILL');
        } else {
          session.child.kill('SIGKILL');
        }
      } catch {
        session.child.kill('SIGKILL');
      }
      return { success: true };
    },
    start(command, cwd) {
      const commandId = `host-${randomUUID()}`;
      const outputDir = path.join(sessionRoot, commandId);
      mkdirSync(outputDir, { recursive: true, mode: 0o700 });
      const stdoutPath = path.join(outputDir, 'stdout.log');
      const stderrPath = path.join(outputDir, 'stderr.log');
      const stdout = createWriteStream(stdoutPath, { mode: 0o600 });
      const stderr = createWriteStream(stderrPath, { mode: 0o600 });
      const shell = shellInvocation(command);
      const child = spawn(shell.executable, shell.args, {
        cwd,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsVerbatimArguments: process.platform === 'win32',
      });
      child.stdout.pipe(stdout);
      child.stderr.pipe(stderr);
      const closed = Promise.all([
        new Promise((resolve) => stdout.once('finish', resolve)),
        new Promise((resolve) => stderr.once('finish', resolve)),
      ]);
      const session = {
        child,
        closed,
        commandId,
        exitCode: undefined,
        startedAt: Date.now(),
        stderrPath,
        stdoutPath,
      };
      sessions.set(commandId, session);
      child.once('close', (code) => {
        session.exitCode = code ?? 0;
        session.endedAt = Date.now();
      });
      child.once('error', () => {
        session.exitCode = 1;
        session.endedAt = Date.now();
        stdout.end();
        stderr.end();
      });
      child.unref();
      return session;
    },
  };
};

const fileEntry = (entryPath, info) => ({
  createdTime: info.birthtime,
  isDirectory: info.isDirectory(),
  lastAccessTime: info.atime,
  modifiedTime: info.mtime,
  name: path.basename(entryPath),
  path: entryPath,
  size: info.size,
  type: info.isDirectory() ? 'directory' : path.extname(entryPath).slice(1) || 'file',
});

async function* walk(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    yield fullPath;
    if (entry.isDirectory()) yield* walk(fullPath);
  }
}

const globToRegExp = (pattern) => {
  let source = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === '*' && pattern[index + 1] === '*') {
      source += '.*';
      index += 1;
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else source += char.replaceAll(/[|\\{}()[\]^$+?.]/g, '\\$&');
  }
  return new RegExp(`^${source}$`);
};

const toolHandlers = (config, sessions) => ({
  async editFile(params, workspace) {
    const filePath = resolveHostPath(workspace, params.path ?? params.file_path);
    const original = await readFile(filePath, 'utf8');
    const search = String(params.search ?? params.old_string ?? '');
    const replacement = String(params.replace ?? params.new_string ?? '');
    if (!search || !original.includes(search)) return errorResult('search text not found');
    const replacements = params.all || params.replace_all ? original.split(search).length - 1 : 1;
    const content =
      params.all || params.replace_all
        ? original.replaceAll(search, replacement)
        : original.replace(search, replacement);
    await writeFile(filePath, content, 'utf8');
    return okResult({
      linesAdded: replacement.split('\n').length - 1,
      linesDeleted: search.split('\n').length - 1,
      replacements,
      success: true,
    });
  },

  async executeCode(params, workspace) {
    const language = String(params.language || 'python');
    const runners = {
      javascript: ['node', 'js'],
      python: ['python3', 'py'],
      typescript: ['npx --yes tsx', 'ts'],
    };
    const runner = runners[language];
    if (!runner) return errorResult(`Unsupported host code language: ${language}`);
    const codeDir = path.join(workspace, '.code');
    await mkdir(codeDir, { recursive: true, mode: 0o700 });
    const codePath = path.join(codeDir, `${Date.now()}-${randomUUID()}.${runner[1]}`);
    await writeFile(codePath, String(params.code || ''), 'utf8');
    const result = await runForeground(
      `${runner[0]} ${shellQuote(codePath)}`,
      workspace,
      numeric(params.timeout ?? params.timeout_ms, DEFAULT_TIMEOUT_MS),
      config.maxOutputBytes,
    );
    return okResult(result);
  },

  async getCommandOutput(params) {
    const commandId = String(params.commandId || params.shell_id || '');
    const session = sessions.get(commandId);
    if (!session) return errorResult(`Command ID ${commandId} not found`);
    if (session.exitCode !== undefined) await session.closed;
    const stdout = readTail(session.stdoutPath, config.maxOutputBytes);
    const stderr = readTail(session.stderrPath, config.maxOutputBytes);
    return okResult({
      commandId,
      durationMs: (session.endedAt || Date.now()) - session.startedAt,
      exitCode: session.exitCode,
      newOutput: `${stdout}${stderr}`,
      output: `${stdout}${stderr}`,
      running: session.exitCode === undefined,
      stderr,
      stdout,
      success: session.exitCode === undefined || session.exitCode === 0,
    });
  },

  async globFiles(params, workspace) {
    const root = resolveHostPath(workspace, params.directory ?? params.scope ?? '.');
    const matcher = globToRegExp(String(params.pattern || '*').replaceAll('\\', '/'));
    const files = [];
    const limit = numeric(params.limit, 1000);
    for await (const entryPath of walk(root)) {
      const relative = path.relative(root, entryPath).replaceAll('\\', '/');
      if (matcher.test(relative) || matcher.test(path.basename(entryPath))) files.push(entryPath);
      if (files.length >= limit) break;
    }
    return okResult({ files, totalCount: files.length, total_files: files.length });
  },

  async grepContent(params, workspace) {
    const root = resolveHostPath(workspace, params.directory ?? params.path ?? '.');
    const expression = new RegExp(String(params.pattern || ''), params['-i'] ? 'i' : '');
    const fileMatcher = globToRegExp(String(params.filePattern || params.glob || '*'));
    const matches = [];
    const limit = numeric(params.head_limit, 1000);
    const candidates = statSync(root).isDirectory() ? walk(root) : [root];
    for await (const entryPath of candidates) {
      const info = await stat(entryPath);
      if (info.isDirectory() || !fileMatcher.test(path.basename(entryPath))) continue;
      let content;
      try {
        content = await readFile(entryPath, 'utf8');
      } catch {
        continue;
      }
      for (const [index, line] of content.split('\n').entries()) {
        if (!expression.test(line)) continue;
        matches.push({ line, lineNumber: index + 1, path: entryPath });
        if (matches.length >= limit) break;
      }
      if (matches.length >= limit) break;
    }
    return okResult({ matches, totalMatches: matches.length, total_matches: matches.length });
  },

  async killCommand(params) {
    return okResult(sessions.kill(String(params.commandId || params.shell_id || '')));
  },

  async listFiles(params, workspace) {
    const directory = resolveHostPath(workspace, params.directoryPath ?? params.path ?? '.');
    let files = await Promise.all(
      (await readdir(directory)).map(async (name) => {
        const entryPath = path.join(directory, name);
        return fileEntry(entryPath, await stat(entryPath));
      }),
    );
    const sortBy = params.sortBy || 'name';
    files.sort((left, right) => {
      if (sortBy === 'size') return left.size - right.size;
      if (sortBy === 'createdTime') return new Date(left.createdTime) - new Date(right.createdTime);
      if (sortBy === 'modifiedTime')
        return new Date(left.modifiedTime) - new Date(right.modifiedTime);
      return left.name.localeCompare(right.name);
    });
    if (params.sortOrder === 'desc') files.reverse();
    const totalCount = files.length;
    if (numeric(params.limit, 0) > 0) files = files.slice(0, params.limit);
    return okResult({ files, totalCount });
  },

  async moveFiles(params, workspace) {
    const operations = Array.isArray(params.operations) ? params.operations : [];
    const results = [];
    for (const operation of operations) {
      const source = resolveHostPath(workspace, operation.source ?? operation.oldPath);
      const destination = resolveHostPath(workspace, operation.destination ?? operation.newPath);
      try {
        await mkdir(path.dirname(destination), { recursive: true });
        await rename(source, destination);
        results.push({ destination, source, success: true });
      } catch (error) {
        results.push({ error: error.message, source, success: false });
      }
    }
    return okResult({
      results,
      successCount: results.filter((item) => item.success).length,
    });
  },

  async readFile(params, workspace) {
    const filePath = resolveHostPath(workspace, params.path);
    const content = await readFile(filePath, 'utf8');
    const lines = content.split(/(?<=\n)/);
    const start = Math.max(1, numeric(params.startLine, 1));
    const end = Math.min(lines.length, numeric(params.endLine, lines.length));
    const selected = lines.slice(start - 1, end).join('');
    return okResult({
      charCount: selected.length,
      content: selected,
      filename: path.basename(filePath),
      loc: [start, end],
      totalCharCount: content.length,
      totalLineCount: lines.length,
    });
  },

  async runCommand(params, workspace) {
    const command = translateCommandPaths(workspace, params.command || '');
    if (!command.trim()) return errorResult('command is required');
    if (params.background || params.run_in_background) {
      const session = sessions.start(command, workspace);
      return okResult({
        commandId: session.commandId,
        output: '',
        shell_id: session.commandId,
        success: true,
      });
    }
    const result = await runForeground(
      command,
      workspace,
      numeric(params.timeout ?? params.timeout_ms, DEFAULT_TIMEOUT_MS),
      config.maxOutputBytes,
    );
    return okResult({ ...result, exit_code: result.exitCode });
  },

  async searchFiles(params, workspace) {
    const root = resolveHostPath(workspace, params.directory ?? params.onlyIn ?? '.');
    const keywords = String(params.keywords ?? params.keyword ?? '')
      .split(/\s+/)
      .filter(Boolean);
    const fileTypes = Array.isArray(params.fileTypes)
      ? params.fileTypes.map((item) => String(item).replace(/^\./, ''))
      : [];
    const results = [];
    const limit = numeric(params.limit, 100);
    for await (const entryPath of walk(root)) {
      const info = await stat(entryPath);
      if (info.isDirectory()) continue;
      const name = path.basename(entryPath);
      if (keywords.length > 0 && !keywords.every((keyword) => name.includes(keyword))) continue;
      if (fileTypes.length > 0 && !fileTypes.includes(path.extname(name).slice(1))) continue;
      if (params.contentContains) {
        try {
          if (!(await readFile(entryPath, 'utf8')).includes(String(params.contentContains)))
            continue;
        } catch {
          continue;
        }
      }
      results.push(fileEntry(entryPath, info));
      if (results.length >= limit) break;
    }
    return okResult({ results, totalCount: results.length });
  },

  async writeFile(params, workspace) {
    const filePath = resolveHostPath(workspace, params.path);
    await mkdir(path.dirname(filePath), { recursive: true });
    const content = String(params.content || '');
    await writeFile(filePath, content, 'utf8');
    return okResult({ bytesWritten: Buffer.byteLength(content), success: true });
  },
});

const aliases = new Map([
  ['editLocalFile', 'editFile'],
  ['globLocalFiles', 'globFiles'],
  ['listLocalFiles', 'listFiles'],
  ['moveLocalFiles', 'moveFiles'],
  ['readLocalFile', 'readFile'],
  ['searchLocalFiles', 'searchFiles'],
  ['writeLocalFile', 'writeFile'],
]);

const handleExecScript = async (handlers, params, workspace) => {
  const urls =
    params.skillZipUrls && typeof params.skillZipUrls === 'object'
      ? Object.entries(params.skillZipUrls).filter(([, value]) => typeof value === 'string')
      : typeof params.zipUrl === 'string'
        ? [['default', params.zipUrl]]
        : [];
  if (urls.length === 0) return handlers.runCommand(params, workspace);

  const hash = createHash('sha256').update(JSON.stringify(urls.sort())).digest('hex').slice(0, 32);
  const skillRoot = path.join(workspace, '.skills', hash);
  const setup = urls.map(([name, url]) => {
    const target = path.join(skillRoot, safeSegment(name));
    return `mkdir -p ${shellQuote(target)} && if [ ! -f ${shellQuote(path.join(target, '.prepared'))} ]; then curl -fsSL ${shellQuote(url)} -o ${shellQuote(path.join(target, 'skill.zip'))} && unzip -q -o ${shellQuote(path.join(target, 'skill.zip'))} -d ${shellQuote(target)} && touch ${shellQuote(path.join(target, '.prepared'))}; fi`;
  });
  const configuredName = params.config?.name;
  const skillName = urls.some(([name]) => name === configuredName) ? configuredName : urls[0][0];
  const runDir = path.join(skillRoot, safeSegment(skillName));
  return handlers.runCommand(
    {
      ...params,
      command: `${setup.join(' && ')} && cd ${shellQuote(runDir)} && ${params.command || ''}`,
    },
    workspace,
  );
};

export const createHostExecutorServer = (overrides = {}) => {
  const config = normalizeConfig(overrides);
  mkdirSync(config.root, { recursive: true, mode: 0o700 });
  const sessions = createSessionManager(config);
  const handlers = toolHandlers(config, sessions);

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://localhost');
      if (request.method === 'GET' && url.pathname === '/health') {
        json(response, 200, { mode: 'host', success: true });
        return;
      }
      if (!isAuthorized(request, config.token)) {
        json(response, 401, { error: { message: 'Unauthorized' }, success: false });
        return;
      }
      if (request.method !== 'POST') {
        json(response, 405, { error: { message: 'Method not allowed' }, success: false });
        return;
      }

      const body = await readBody(request);
      const workspace = workspaceFor(config, body);

      if (url.pathname === '/v1/tools/call') {
        const params = body.params && typeof body.params === 'object' ? body.params : {};
        const toolName = aliases.get(body.toolName) || body.toolName;
        if (toolName === 'execScript') {
          json(response, 200, await handleExecScript(handlers, params, workspace));
          return;
        }
        const handler = handlers[toolName];
        if (!handler) {
          json(response, 200, errorResult(`Unsupported host executor tool: ${body.toolName}`));
          return;
        }
        json(response, 200, await handler(params, workspace));
        return;
      }

      if (url.pathname === '/v1/files/export') {
        const filePath = resolveHostPath(workspace, body.path);
        const fileInfo = await stat(filePath);
        const upload = await fetch(body.uploadUrl, {
          body: createReadStream(filePath),
          duplex: 'half',
          headers: body.uploadHeaders || {},
          method: 'PUT',
        });
        if (!upload.ok) {
          json(response, 502, {
            error: { message: `Host file upload failed with HTTP ${upload.status}` },
            success: false,
          });
          return;
        }
        json(response, 200, { size: fileInfo.size, success: true });
        return;
      }

      json(response, 404, { error: { message: 'Not found' }, success: false });
    } catch (error) {
      json(response, 500, errorResult(error.message, error.name));
    }
  });

  return { config, server };
};

export const startHostExecutor = async (overrides = {}) => {
  const { config, server } = createHostExecutorServer(overrides);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, resolve);
  });
  console.info(`lobe-host-executor listening on ${config.host}:${config.port}`);
  return server;
};

const isEntrypoint =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isEntrypoint) {
  startHostExecutor().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
