/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('node:http');
const { spawn } = require('node:child_process');
const { URL } = require('node:url');
const { WebSocket, WebSocketServer } = require('ws');

const WEBSOCKET_PATH = '/api/trpc-ws';
const INTERNAL_READY_PATH = '/api/version';
const MESSAGE_SUBSCRIPTION_QUERY_PATH = 'message.getRealtimeSubscription';
const MAX_WEBSOCKET_PAYLOAD = 16 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 15_000;
const REALTIME_BRIDGE_ERROR_SOURCE = 'realtime-bridge';
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

const createRedisMessageBroker = ({ RedisClass, redisUrl = process.env.REDIS_URL } = {}) => {
  if (!redisUrl) {
    return {
      available: false,
      close: async () => {},
      subscribe: async () => {
        throw new Error('Realtime message subscriptions require REDIS_URL');
      },
    };
  }

  const Redis = RedisClass || require('ioredis');
  const subscriber = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });
  const subscriptions = new Map();

  subscriber.on('message', (channel, payload) => {
    const subscription = subscriptions.get(channel);
    if (!subscription) return;
    for (const listener of subscription.listeners) listener(payload);
  });
  subscriber.on('error', (error) => {
    console.error('[Realtime messages] Redis subscriber error:', error.message);
  });

  const ensureConnected = async () => {
    if (subscriber.status === 'wait') await subscriber.connect();
  };

  return {
    available: true,
    close: async () => {
      subscriptions.clear();
      if (subscriber.status === 'end') return;
      if (subscriber.status === 'wait') {
        subscriber.disconnect();
        return;
      }
      await subscriber.quit().catch(() => subscriber.disconnect());
    },
    subscribe: async (channel, listener) => {
      let subscription = subscriptions.get(channel);
      if (!subscription) {
        subscription = {
          listeners: new Set(),
          ready: (async () => {
            await ensureConnected();
            await subscriber.subscribe(channel);
          })(),
        };
        subscriptions.set(channel, subscription);
      }
      subscription.listeners.add(listener);

      try {
        await subscription.ready;
      } catch (error) {
        subscription.listeners.delete(listener);
        if (subscription.listeners.size === 0) subscriptions.delete(channel);
        throw error;
      }

      let active = true;
      return async () => {
        if (!active) return;
        active = false;

        const currentSubscription = subscriptions.get(channel);
        if (!currentSubscription) return;
        currentSubscription.listeners.delete(listener);
        if (currentSubscription.listeners.size > 0) return;

        subscriptions.delete(channel);
        await currentSubscription.ready.catch(() => {});
        await subscriber.unsubscribe(channel).catch(() => {});
      };
    },
  };
};

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
  typeof path === 'string' && /^[a-z\d][\w.-]{0,255}$/i.test(path);

const createBridgeError = (id, path, message, code = 'BAD_REQUEST', httpStatus = 400) => ({
  id: id ?? null,
  error: {
    code: code === 'BAD_REQUEST' ? -32600 : -32603,
    data: {
      code,
      httpStatus,
      path,
      source: REALTIME_BRIDGE_ERROR_SOURCE,
    },
    message,
  },
});

const toWebSocketResponse = (id, parsed, statusCode) => {
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (!Object.prototype.hasOwnProperty.call(parsed, 'result') &&
      !Object.prototype.hasOwnProperty.call(parsed, 'error'))
  ) {
    return createBridgeError(
      id,
      undefined,
      `Internal tRPC response was invalid (${statusCode})`,
      'INTERNAL_SERVER_ERROR',
      502,
    );
  }

  if (Object.prototype.hasOwnProperty.call(parsed, 'error')) {
    const upstreamError =
      parsed.error &&
      typeof parsed.error === 'object' &&
      'json' in parsed.error &&
      parsed.error.json &&
      typeof parsed.error.json === 'object'
        ? parsed.error.json
        : parsed.error;

    if (
      !upstreamError ||
      typeof upstreamError !== 'object' ||
      typeof upstreamError.code !== 'number' ||
      typeof upstreamError.message !== 'string'
    ) {
      return createBridgeError(
        id,
        undefined,
        `Internal tRPC error response was invalid (${statusCode})`,
        'INTERNAL_SERVER_ERROR',
        502,
      );
    }

    return {
      error: upstreamError,
      id,
      ...(parsed.jsonrpc ? { jsonrpc: parsed.jsonrpc } : {}),
    };
  }

  if (
    !parsed.result ||
    typeof parsed.result !== 'object' ||
    !Object.prototype.hasOwnProperty.call(parsed.result, 'data')
  ) {
    return createBridgeError(
      id,
      undefined,
      `Internal tRPC result response was invalid (${statusCode})`,
      'INTERNAL_SERVER_ERROR',
      502,
    );
  }

  return {
    id,
    ...(parsed.jsonrpc ? { jsonrpc: parsed.jsonrpc } : {}),
    result: {
      data: parsed.result.data,
      type: 'data',
    },
  };
};

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
  agent,
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
        agent,
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
  agent,
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
      agent,
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

    const response = toWebSocketResponse(id, parsed, upstream.statusCode);
    if (response.error?.data && typeof response.error.data === 'object') {
      response.error.data.path ??= path;
    }

    return response;
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

const getTrpcResultData = (response) => {
  const data = response?.result?.data;
  if (!data || typeof data !== 'object') return data;
  return Object.prototype.hasOwnProperty.call(data, 'json') ? data.json : data;
};

const requestMessageSubscriptionChannels = async ({
  activeRequests,
  agent,
  connectionHeaders,
  context,
  internalHost,
  internalPort,
  requestHeaders,
  subscriptionId,
}) => {
  const upstream = await requestInternalQuery({
    activeRequests,
    agent,
    connectionHeaders,
    internalHost,
    internalPort,
    path: MESSAGE_SUBSCRIPTION_QUERY_PATH,
    request: { params: { input: { json: context } } },
    requestHeaders,
  });

  let parsed;
  try {
    parsed = JSON.parse(upstream.body);
  } catch {
    return {
      error: createBridgeError(
        subscriptionId,
        MESSAGE_SUBSCRIPTION_QUERY_PATH,
        `Internal subscription response was not JSON (${upstream.statusCode})`,
        'INTERNAL_SERVER_ERROR',
        502,
      ).error,
    };
  }

  const response = toWebSocketResponse(subscriptionId, parsed, upstream.statusCode);
  if (response.error) return { error: response.error };

  const result = getTrpcResultData(response);
  const channels = result?.channels;
  if (
    !Array.isArray(channels) ||
    channels.length === 0 ||
    channels.some(
      (channel) => typeof channel !== 'string' || !/^[\w:-]{1,256}$/.test(channel),
    )
  ) {
    return {
      error: createBridgeError(
        subscriptionId,
        MESSAGE_SUBSCRIPTION_QUERY_PATH,
        'Internal subscription response did not contain valid channels',
        'INTERNAL_SERVER_ERROR',
        502,
      ).error,
    };
  }

  return { channels };
};

const safeSendJson = (client, payload) => {
  if (client.readyState !== WebSocket.OPEN) return;
  client.send(JSON.stringify(payload));
};

const rejectUpgrade = (socket, statusCode, message) => {
  if (!socket.writable) return;
  socket.write(
    `HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
  );
  socket.destroy();
};

const proxyHttpRequest = ({ agent, internalHost, internalPort, request, response }) => {
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
      agent,
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
  messageBroker = createRedisMessageBroker(),
  publicPort,
}) => {
  const upstreamAgent = new http.Agent({
    keepAlive: true,
    maxFreeSockets: 32,
    maxSockets: 128,
  });
  const server = http.createServer((request, response) => {
    proxyHttpRequest({
      agent: upstreamAgent,
      internalHost,
      internalPort,
      request,
      response,
    });
  });
  const websocketServer = new WebSocketServer({
    maxPayload: MAX_WEBSOCKET_PAYLOAD,
    noServer: true,
  });
  const heartbeatTimer = setInterval(() => {
    for (const client of websocketServer.clients) {
      if (client.isAlive === false) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, 30_000);
  heartbeatTimer.unref?.();

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
    client.isAlive = true;
    client.on('pong', () => {
      client.isAlive = true;
    });
    const activeRequests = new Set();
    const messageSubscriptions = new Map();
    const pendingMessageSubscriptions = new Set();
    let connectionHeaders = copyForwardedHeaders(request.headers);

    const closeActiveRequests = () => {
      for (const activeRequest of activeRequests) activeRequest.destroy();
      activeRequests.clear();
    };

    const closeMessageSubscription = async (subscriptionId) => {
      pendingMessageSubscriptions.delete(subscriptionId);
      const disposers = messageSubscriptions.get(subscriptionId);
      if (!disposers) return;
      messageSubscriptions.delete(subscriptionId);
      await Promise.all(disposers.map((dispose) => dispose().catch(() => {})));
    };

    const closeMessageSubscriptions = async () => {
      pendingMessageSubscriptions.clear();
      await Promise.all([...messageSubscriptions.keys()].map(closeMessageSubscription));
    };

    const handleMessageSubscription = async (message) => {
      const subscriptionId = message?.subscriptionId;
      if (
        typeof subscriptionId !== 'string' ||
        subscriptionId.length === 0 ||
        subscriptionId.length > 128 ||
        !message.context ||
        typeof message.context !== 'object'
      ) {
        safeSendJson(client, {
          error: createBridgeError(
            subscriptionId,
            MESSAGE_SUBSCRIPTION_QUERY_PATH,
            'Invalid message subscription request',
          ).error,
          subscriptionId: subscriptionId ?? null,
          type: 'subscription.error',
        });
        return;
      }

      if (!messageBroker.available) {
        safeSendJson(client, {
          error: createBridgeError(
            subscriptionId,
            MESSAGE_SUBSCRIPTION_QUERY_PATH,
            'Realtime message subscriptions are unavailable',
            'INTERNAL_SERVER_ERROR',
            503,
          ).error,
          subscriptionId,
          type: 'subscription.error',
        });
        return;
      }

      await closeMessageSubscription(subscriptionId);
      pendingMessageSubscriptions.add(subscriptionId);

      const disposers = [];
      try {
        const result = await requestMessageSubscriptionChannels({
          activeRequests,
          agent: upstreamAgent,
          connectionHeaders,
          context: message.context,
          internalHost,
          internalPort,
          requestHeaders: request.headers,
          subscriptionId,
        });

        if (!pendingMessageSubscriptions.has(subscriptionId) || client.readyState !== WebSocket.OPEN)
          return;

        if (result.error) {
          pendingMessageSubscriptions.delete(subscriptionId);
          safeSendJson(client, {
            error: result.error,
            subscriptionId,
            type: 'subscription.error',
          });
          return;
        }

        for (const channel of result.channels) {
          const dispose = await messageBroker.subscribe(channel, (payload) => {
            let event;
            try {
              event = JSON.parse(payload);
            } catch {
              return;
            }
            if (event?.type !== 'messages.updated') return;

            safeSendJson(client, {
              reason: event.reason,
              subscriptionId,
              timestamp: event.timestamp,
              type: 'messages.updated',
            });
          });
          disposers.push(dispose);
        }

        if (pendingMessageSubscriptions.has(subscriptionId) && client.readyState === WebSocket.OPEN) {
          pendingMessageSubscriptions.delete(subscriptionId);
          messageSubscriptions.set(subscriptionId, disposers);
          safeSendJson(client, { subscriptionId, type: 'subscription.ready' });
        } else {
          await Promise.all(disposers.map((dispose) => dispose().catch(() => {})));
        }
      } catch (error) {
        pendingMessageSubscriptions.delete(subscriptionId);
        await Promise.all(disposers.map((dispose) => dispose().catch(() => {})));
        safeSendJson(client, {
          error: createBridgeError(
            subscriptionId,
            MESSAGE_SUBSCRIPTION_QUERY_PATH,
            error instanceof Error ? error.message : 'Failed to subscribe to message updates',
            'INTERNAL_SERVER_ERROR',
            502,
          ).error,
          subscriptionId,
          type: 'subscription.error',
        });
      }
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

      if (message?.type === 'subscribeMessages') {
        await handleMessageSubscription(message);
        return;
      }

      if (message?.type === 'unsubscribeMessages') {
        if (typeof message.subscriptionId === 'string') {
          await closeMessageSubscription(message.subscriptionId);
        }
        return;
      }

      const requests = Array.isArray(message) ? message : [message];
      const responses = await Promise.all(
        requests.map((requestMessage) =>
          forwardQuery({
            activeRequests,
            agent: upstreamAgent,
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
    const closeConnectionResources = () => {
      closeActiveRequests();
      void closeMessageSubscriptions();
    };
    client.once('close', closeConnectionResources);
    client.once('error', closeConnectionResources);
  });

  const close = async () => {
    clearInterval(heartbeatTimer);
    for (const client of websocketServer.clients) client.close(1001, 'Server shutting down');
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
    upstreamAgent.destroy();
    await messageBroker.close().catch(() => {});
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
  createRedisMessageBroker,
  createRealtimeServer,
  isAllowedProcedurePath,
  isAllowedWebSocketOrigin,
  runRealtimeServer,
  toWebSocketResponse,
};
