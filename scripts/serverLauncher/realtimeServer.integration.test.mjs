// @vitest-environment node

import { createServer } from 'node:http';
import { createRequire } from 'node:module';

import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { WebSocket } = require('ws');
const { createRealtimeServer } = require('./realtimeServer.js');

const listen = (server, port = 0) =>
  new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve(server.address().port);
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });

const close = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

const closeSocket = (socket) =>
  new Promise((resolve) => {
    if (socket.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }

    socket.once('close', resolve);
    socket.close();
  });

const readBody = (request) =>
  new Promise((resolve) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.once('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });

const readWebSocketMessage = (socket) =>
  new Promise((resolve, reject) => {
    const onMessage = (data) => {
      cleanup();
      resolve(JSON.parse(data.toString('utf8')));
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off('message', onMessage);
      socket.off('error', onError);
    };

    socket.once('message', onMessage);
    socket.once('error', onError);
  });

describe('realtime server integration', () => {
  let internalServer;
  let realtimeServer;

  afterEach(async () => {
    if (realtimeServer) await realtimeServer.close();
    if (internalServer?.listening) await close(internalServer);
    realtimeServer = undefined;
    internalServer = undefined;
  });

  it('forwards HTTP writes and WebSocket queries through the same public port', async () => {
    const observed = [];
    internalServer = createServer(async (request, response) => {
      if (request.url === '/api/version') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ version: 'test' }));
        return;
      }

      if (request.url?.startsWith('/trpc/lambda/user.getUserState')) {
        observed.push({
          cookie: request.headers.cookie,
          method: request.method,
          url: request.url,
        });
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ result: { data: { userId: 'user-1' } } }));
        return;
      }

      if (request.url === '/api/echo') {
        observed.push({
          body: await readBody(request),
          contentType: request.headers['content-type'],
          method: request.method,
        });
        response.writeHead(201, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ ok: true }));
        return;
      }

      response.writeHead(404);
      response.end();
    });

    const internalPort = await listen(internalServer);
    realtimeServer = createRealtimeServer({
      internalPort,
      listenHost: '127.0.0.1',
      publicPort: 0,
    });
    const publicPort = await realtimeServer.listen().then(() => realtimeServer.server.address().port);

    const httpResponse = await fetch(`http://127.0.0.1:${publicPort}/api/echo`, {
      body: 'hello',
      headers: {
        'content-type': 'application/custom',
      },
      method: 'POST',
    });
    expect(httpResponse.status).toBe(201);
    expect(await httpResponse.json()).toEqual({ ok: true });

    const origin = `http://127.0.0.1:${publicPort}`;
    const socket = new WebSocket(`ws://127.0.0.1:${publicPort}/api/trpc-ws`, {
      headers: {
        cookie: 'session=test-session',
        origin,
      },
    });
    await new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });

    const responsePromise = readWebSocketMessage(socket);
    socket.send(
      JSON.stringify({
        id: 1,
        method: 'query',
        params: {
          input: { json: {} },
          path: 'user.getUserState',
        },
      }),
    );

    await expect(responsePromise).resolves.toEqual({
      id: 1,
      result: {
        data: { userId: 'user-1' },
        type: 'data',
      },
    });
    expect(observed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          body: 'hello',
          contentType: 'application/custom',
          method: 'POST',
        }),
        expect.objectContaining({
          cookie: 'session=test-session',
          method: 'GET',
        }),
      ]),
    );

    await closeSocket(socket);
  });

  it('rejects WebSocket mutations without forwarding them upstream', async () => {
    let upstreamCalls = 0;
    internalServer = createServer((request, response) => {
      if (request.url === '/api/version') {
        response.writeHead(200);
        response.end('ok');
        return;
      }

      upstreamCalls += 1;
      response.writeHead(500);
      response.end();
    });

    const internalPort = await listen(internalServer);
    realtimeServer = createRealtimeServer({
      internalPort,
      listenHost: '127.0.0.1',
      publicPort: 0,
    });
    const publicPort = await realtimeServer.listen().then(() => realtimeServer.server.address().port);
    const origin = `http://127.0.0.1:${publicPort}`;
    const socket = new WebSocket(`ws://127.0.0.1:${publicPort}/api/trpc-ws`, {
      headers: { origin },
    });
    await new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });

    const responsePromise = readWebSocketMessage(socket);
    socket.send(
      JSON.stringify({
        id: 'mutation-1',
        method: 'mutation',
        params: {
          path: 'message.create',
        },
      }),
    );

    const response = await responsePromise;
    expect(response.error.data).toEqual(
      expect.objectContaining({
        code: 'BAD_REQUEST',
        source: 'realtime-bridge',
      }),
    );
    expect(upstreamCalls).toBe(0);

    await closeSocket(socket);
  });

  it('authenticates message subscriptions and forwards broker invalidations', async () => {
    const listeners = new Map();
    const subscribedChannels = [];
    const messageBroker = {
      available: true,
      close: vi.fn(async () => {}),
      subscribe: vi.fn(async (channel, listener) => {
        subscribedChannels.push(channel);
        listeners.set(channel, listener);
        return async () => listeners.delete(channel);
      }),
    };
    const observed = [];

    internalServer = createServer((request, response) => {
      if (request.url === '/api/version') {
        response.writeHead(200);
        response.end('ok');
        return;
      }

      if (request.url?.startsWith('/trpc/lambda/message.getRealtimeSubscription')) {
        observed.push({ cookie: request.headers.cookie, url: request.url });
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            result: {
              data: {
                json: {
                  channels: ['lobe:messages:v1:conversation:test', 'lobe:messages:v1:global:test'],
                },
              },
            },
          }),
        );
        return;
      }

      response.writeHead(404);
      response.end();
    });

    const internalPort = await listen(internalServer);
    realtimeServer = createRealtimeServer({
      internalPort,
      listenHost: '127.0.0.1',
      messageBroker,
      publicPort: 0,
    });
    const publicPort = await realtimeServer.listen().then(() => realtimeServer.server.address().port);
    const origin = `http://127.0.0.1:${publicPort}`;
    const socket = new WebSocket(`ws://127.0.0.1:${publicPort}/api/trpc-ws`, {
      headers: { cookie: 'session=test-session', origin },
    });
    await new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });

    const readyPromise = readWebSocketMessage(socket);
    socket.send(
      JSON.stringify({
        context: { agentId: 'agent-1', topicId: 'topic-1' },
        subscriptionId: 'subscription-1',
        type: 'subscribeMessages',
      }),
    );

    await expect(readyPromise).resolves.toEqual({
      subscriptionId: 'subscription-1',
      type: 'subscription.ready',
    });
    expect(subscribedChannels).toEqual([
      'lobe:messages:v1:conversation:test',
      'lobe:messages:v1:global:test',
    ]);
    expect(observed[0]).toEqual(
      expect.objectContaining({
        cookie: 'session=test-session',
      }),
    );
    expect(decodeURIComponent(observed[0].url)).toContain(
      '"json":{"agentId":"agent-1","topicId":"topic-1"}',
    );

    const updatePromise = readWebSocketMessage(socket);
    listeners.get('lobe:messages:v1:conversation:test')(
      JSON.stringify({ reason: 'edit', timestamp: 123, type: 'messages.updated' }),
    );
    await expect(updatePromise).resolves.toEqual({
      reason: 'edit',
      subscriptionId: 'subscription-1',
      timestamp: 123,
      type: 'messages.updated',
    });

    socket.send(
      JSON.stringify({ subscriptionId: 'subscription-1', type: 'unsubscribeMessages' }),
    );
    await vi.waitFor(() => expect(listeners.size).toBe(0));
    await closeSocket(socket);
  });
});
