const http = require('node:http');
const { spawn } = require('node:child_process');
const { URL } = require('node:url');
const { WebSocket, WebSocketServer } = require('ws');

const WEBSOCKET_PATH = '/api/trpc-ws';
const INTERNAL_READY_PATH = '/api/version';
const MAX_WEBSOCKET_PAYLOAD = 16 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 15_000;
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);
const FORWARDED_WEBSOCKET_HEADERS = new Set([
  'accept',
  'accept-encoding',
  'authorization',
  'cookie',
  'origin',
  'referer',
  'trpc-accept',
  'user-agent',
]);

const asHeaderString = (value) => {
  if (Array.isArray(value)) return value.join(', ');
  return value;
};

const copyForwardedHeaders = (
  incomingHeaders,
  extraHeaders = {},
  includeAllEndToEndHeaders = false,
) => {
  const headers = {};

  for (const [name, value] of Object.entries(incomingHeaders || {})) {
    const lowerName = name.toLowerCase();
    const stringValue = asHeaderString(value);
    if (!stringValue || HOP_BY_HOP_HEADERS.has(lowerName)) continue;

    if (
      includeAllEndToEndHeaders ||
      lowerName.startsWith('x-') ||
      FORWARDED_WEBSOCKET_HEADERS.has(lowerName)
    ) {
      headers[lowerName] = stringValue;
    }
  }

  for (const [name, value] of Object.entries(extraHeaders)) {
    if (value !== undefined && value !== null && value !== '') {
      headers[name.toLowerCase()] = String(value);
    }
  }

  return headers;
};

const getRequestHost = (request) =>
  asHeaderString(request.headers.host) ||
  asHeaderString(request.headers['x-forwarded-host']) ||
  'localhost';

const getForwardedProtocol = (request) => {
  const forwardedProtocol = asHeaderString(request.headers['x-forwarded-proto']);
  if (forwardedProtocol) return forwardedProtocol.split(',')[0].trim();
  return 'http';
};

const getOriginHosts = (request) => {
  const hosts = new Set([getRequestHost(request)]);
  const forwardedHost = asHeaderString(request.headers['x-forwarded-host']);
  if (forwardedHost) hosts.add(forwardedHost.split(',')[0].trim());

  if (process.env.APP_URL) {
    try {
      hosts.add(new URL(process.env.APP_URL).host);
    } catch {
      // Ignore an invalid optional APP_URL; the request host remains authoritative.
    }
  }

  return hosts;
};

const isAllowedWebSocketOrigin = (request) => {
  const origin = asHeaderString(request.headers.origin);
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    if (!['http:', 'https:'].includes(originUrl.protocol)) return false;
    return getOriginHosts(request).has(originUrl.host);
  } catch {
    return false;
  }
};

const isAllowedProcedurePath = (path) =>
  typeof path === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/.test(path);

const createBridgeError = (id, path, message, code = 'BAD_REQUEST', httpStatus = 400) => ({
  id: id ?? null,
  error: {
    json: {
      code: code === 'BAD_REQUEST' ? -32600 : -32603,
      data: {
        code,
        httpStatus,
        path,
      },
      message,
    },
  },
});

const parseWebSocketMessage = (rawData) => {
  const text = Buffer.isBuffer(rawData) ? rawData.toString('utf8') : String(rawData);
  return JSON.parse(text);
};

const getConnectionHeaders = (data) => {
  if (!data || typeof data !== 'object' || !data.headers || typeof data.headers !== 'object') {
    return {};
  }

  return copyForwardedHeaders(data.headers);
};

const requestInternalQuery = ({
  connectionHeaders,
  internalHost,
  internalPort,
  path,
  request,
  requestHeaders,
  activeRequests,
}) =>
  new Promise((resolve, reject) => {
    const params = request.params || {};
    const upstreamUrl = new URL(
      `/trpc/lambda/${encodeURIComponent(path)}`,
      `http://${internalHost}:${internalPort}`,
    );

    if (params.input !== undefined) {
      upstreamUrl.searchParams.set('input', JSON.stringify(params.input));
    }

    const headers = copyForwardedHeaders(requestHeaders, connectionHeaders);
    const upstreamRequest = http.request(
      {
        hostname: internalHost,
        path: `${upstreamUrl.pathname}${upstreamUrl.search}`,
        port: internalPort,
        method: 'GET',
        headers,
      },
      (upstreamResponse) => {
        const chunks = [];
        upstreamResponse.on('data', (chunk) => chunks.push(chunk));
        upstreamResponse.once('end', () => {
          activeRequests.delete(upstreamRequest);
          resolve({
            body: Buffer.concat(chunks).toString('utf8'),
            statusCode: upstreamResponse.statusCode || 502,
          });
        });
        upstreamResponse.once('error', (error) => {
          activeRequests.delete(upstreamRequest);
          reject(error);
        });
      },
    );

    activeRequests.add(upstreamRequest);
    upstreamRequest.setTimeout(UPSTREAM_TIMEOUT_MS, () => {
      upstreamRequest.destroy(new Error('Realtime bridge upstream timeout'));
    });
    upstreamRequest.once('error', (error) => {
      activeRequests.delete(upstreamRequest);
      reject(error);
    });
    upstreamRequest.end();
  });

const forwardQuery = async ({
  connectionHeaders,
  internalHost,
  internalPort,
  request,
  requestHeaders,
  activeRequests,
}) => {
  const id = request?.id;
  const params = request?.params;
  const path = params?.path;

  if (!request || typeof request !== 'object' || id === undefined || id === null) {
    return createBridgeError(id, undefined, '`id` is required');
  }
  if (request.method !== 'query') {
    return createBridgeError(id, path, 'The realtime bridge only accepts query operations');
  }
  if (!params || !isAllowedProcedurePath(path)) {
    return createBridgeError(id, path, 'Invalid tRPC query path');
  }

  try {
    const upstream = await requestInternalQuery({
      activeRequests,
      connectionHeaders,
      internalHost,
      internalPort,
      path,
      request,
      requestHeaders,
    });
    let parsed;
    try {
      parsed = JSON.parse(upstream.body);
    } catch {
      return createBridgeError(
        id,
        path,
        `Internal tRPC response was not JSON (${upstream.statusCode})`,
        'INTERNAL_SERVER_ERROR',
        502,
      );
    }

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      (!Object.prototype.hasOwnProperty.call(parsed, 'result') &&
        !Object.prototype.hasOwnProperty.call(parsed, 'error'))
    ) {
      return createBridgeError(
        id,
        path,
        `Internal tRPC response was invalid (${upstream.statusCode})`,
        'INTERNAL_SERVER_ERROR',
        502,
      );
    }

    return { ...parsed, id };
  } catch (error) {
    return createBridgeError(
      id,
      path,
      error instanceof Error ? error.message : 'Internal tRPC request failed',
      'INTERNAL_SERVER_ERROR',
      502,
    );
  }
};

const rejectUpgrade = (socket, statusCode, message) => {
  if (!socket.writable) return;
  socket.write(
    `HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
  );
  socket.destroy();
};

const proxyHttpRequest = ({ internalHost, internalPort, request, response }) => {
  if (new URL(request.url || '/', `http://${getRequestHost(request)}`).pathname === WEBSOCKET_PATH) {
    response.writeHead(426, {
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
    });
    response.end('WebSocket Upgrade Required');
    return;
  }

  const headers = copyForwardedHeaders(
    request.headers,
    {
      host: getRequestHost(request),
      'x-forwarded-proto': getForwardedProtocol(request),
      'x-forwarded-host': getRequestHost(request),
    },
    true,
  );
  const remoteAddress = request.socket.remoteAddress;
  const previousForwardedFor = asHeaderString(request.headers['x-forwarded-for']);
  headers['x-forwarded-for'] = [previousForwardedFor, remoteAddress].filter(Boolean).join(', ');

  const upstreamRequest = http.request(
    {
      hostname: internalHost,
      path: request.url,
      port: internalPort,
      method: request.method,
      headers,
    },
    (upstreamResponse) => {
      const responseHeaders = {};
      for (const [name, value] of Object.entries(upstreamResponse.headers)) {
        if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase()) && value !== undefined) {
          responseHeaders[name] = value;
        }
      }

      response.writeHead(upstreamResponse.statusCode || 502, responseHeaders);
      upstreamResponse.pipe(response);
    },
  );

  upstreamRequest.once('error', (error) => {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }

    response.writeHead(502, {
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
    });
    response.end('Upstream server unavailable');
  });
  request.once('aborted', () => upstreamRequest.destroy());
  response.once('close', () => upstreamRequest.destroy());
  request.pipe(upstreamRequest);
};

const createRealtimeServer = ({
  internalHost = '127.0.0.1',
  internalPort,
  listenHost = '0.0.0.0',
  publicPort,
}) => {
  const server = http.createServer((request, response) => {
    proxyHttpRequest({ internalHost, internalPort, request, response });
  });
  const websocketServer = new WebSocketServer({
    maxPayload: MAX_WEBSOCKET_PAYLOAD,
    noServer: true,
  });

  server.on('upgrade', (request, socket, head) => {
    let pathname;
    try {
      pathname = new URL(request.url || '/', `http://${getRequestHost(request)}`).pathname;
    } catch {
      rejectUpgrade(socket, 400, 'Bad Request');
      return;
    }

    if (pathname !== WEBSOCKET_PATH) {
      rejectUpgrade(socket, 404, 'Not Found');
      return;
    }
    if (!isAllowedWebSocketOrigin(request)) {
      rejectUpgrade(socket, 403, 'Forbidden');
      return;
    }

    websocketServer.handleUpgrade(request, socket, head, (client) => {
      websocketServer.emit('connection', client, request);
    });
  });

  websocketServer.on('connection', (client, request) => {
    const activeRequests = new Set();
    let connectionHeaders = copyForwardedHeaders(request.headers);

    const closeActiveRequests = () => {
      for (const activeRequest of activeRequests) activeRequest.destroy();
      activeRequests.clear();
    };

    client.on('message', async (rawData, isBinary) => {
      if (!isBinary) {
        const text = rawData.toString();
        if (text === 'PING') {
          client.send('PONG');
          return;
        }
        if (text === 'PONG') return;
      }

      let message;
      try {
        message = parseWebSocketMessage(rawData);
      } catch {
        client.send(JSON.stringify(createBridgeError(null, undefined, 'Malformed JSON message')));
        return;
      }

      if (message?.method === 'connectionParams') {
        connectionHeaders = {
          ...connectionHeaders,
          ...getConnectionHeaders(message.data),
        };
        return;
      }

      const requests = Array.isArray(message) ? message : [message];
      const responses = await Promise.all(
        requests.map((requestMessage) =>
          forwardQuery({
            activeRequests,
            connectionHeaders,
            internalHost,
            internalPort,
            request: requestMessage,
            requestHeaders: request.headers,
          }),
        ),
      );

      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(Array.isArray(message) ? responses : responses[0]));
      }
    });
    client.once('close', closeActiveRequests);
    client.once('error', closeActiveRequests);
  });

  const close = async () => {
    for (const client of websocketServer.clients) client.close(1001, 'Server shutting down');
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
  };

  const listen = () =>
    new Promise((resolve, reject) => {
      const onError = (error) => {
        server.off('listening', onListening);
        reject(error);
      };
      const onListening = () => {
        server.off('error', onError);
        resolve();
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(publicPort, listenHost);
    });

  return { close, listen, server, websocketServer };
};

const waitForInternalServer = ({ child, internalHost, internalPort }) =>
  new Promise((resolve, reject) => {
    let settled = false;
    let attempts = 0;
    let retryTimer;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(retryTimer);
      child.off('exit', onExit);
      if (error) reject(error);
      else resolve();
    };
    const onExit = (code, signal) => {
      finish(new Error(`Internal Next server exited before readiness (${code ?? signal})`));
    };
    const probe = () => {
      if (settled) return;
      attempts += 1;
      const request = http.get(
        {
          hostname: internalHost,
          path: INTERNAL_READY_PATH,
          port: internalPort,
        },
        (response) => {
          response.resume();
          if (response.statusCode && response.statusCode < 500) {
            finish();
            return;
          }
          retryTimer = setTimeout(probe, Math.min(1000, 100 + attempts * 25));
        },
      );
      request.setTimeout(1000, () => request.destroy());
      request.once('error', () => {
        retryTimer = setTimeout(probe, Math.min(1000, 100 + attempts * 25));
      });
    };

    child.once('exit', onExit);
    probe();
  });

const runRealtimeServer = async ({
  internalPort,
  listenHost = '0.0.0.0',
  publicPort,
  serverScriptPath,
  useProxy = false,
}) => {
  const internalHost = '127.0.0.1';
  const command = useProxy ? '/bin/proxychains' : process.execPath;
  const args = useProxy
    ? ['-q', process.execPath, serverScriptPath]
    : [serverScriptPath];
  const child = spawn(command, args, {
    env: {
      ...process.env,
      HOSTNAME: internalHost,
      PORT: String(internalPort),
    },
    stdio: 'inherit',
  });

  const realtimeServer = createRealtimeServer({
    internalHost,
    internalPort,
    listenHost,
    publicPort,
  });
  let shuttingDown = false;
  let resolveRun;
  let rejectRun;
  const runPromise = new Promise((resolve, reject) => {
    resolveRun = resolve;
    rejectRun = reject;
  });

  const shutdown = async (exitCode) => {
    if (shuttingDown) return;
    shuttingDown = true;
    child.kill('SIGTERM');
    await realtimeServer.close().catch(() => {});
    if (exitCode === undefined) resolveRun();
    else rejectRun(new Error(`Internal Next server exited with code ${exitCode}`));
  };

  child.once('exit', (code, signal) => {
    if (shuttingDown) return;
    void shutdown(code ?? signal);
  });

  process.once('SIGTERM', () => void shutdown());
  process.once('SIGINT', () => void shutdown());

  try {
    await waitForInternalServer({ child, internalHost, internalPort });
    await realtimeServer.listen();
    console.log(
      `✅ Realtime server: HTTP proxy on ${listenHost}:${publicPort}, WebSocket ${WEBSOCKET_PATH}`,
    );
  } catch (error) {
    await shutdown(error instanceof Error ? error.message : 1);
    throw error;
  }

  await runPromise;
};

module.exports = {
  WEBSOCKET_PATH,
  copyForwardedHeaders,
  createBridgeError,
  createRealtimeServer,
  isAllowedProcedurePath,
  isAllowedWebSocketOrigin,
  runRealtimeServer,
};
