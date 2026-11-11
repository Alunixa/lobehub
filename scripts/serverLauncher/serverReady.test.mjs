// @vitest-environment node

import { EventEmitter, once } from 'node:events';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';

import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { waitForInternalServer } = require('./serverReady.js');

describe('internal server readiness', () => {
  let server;
  const timers = new Set();

  const later = (callback, delay) => {
    const timer = setTimeout(callback, delay);
    timers.add(timer);
  };
  const setup = async (handler) => {
    server = createServer(handler);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const child = new EventEmitter();
    child.exitCode = null;
    return {
      child,
      internalHost: '127.0.0.1',
      internalPort: server.address().port,
      timeoutMs: 3000,
    };
  };
  const respond = (response, status = 200, body = '{"version":"test"}') => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(body);
  };

  afterEach(async () => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      server = undefined;
    }
  });

  it('waits for a complete version response and removes child listeners', async () => {
    const options = await setup((_, response) => respond(response));
    await waitForInternalServer(options);
    expect(options.child.listenerCount('exit')).toBe(0);
    expect(options.child.listenerCount('error')).toBe(0);
  });

  it('allows cold-start responses taking longer than the former one-second probe', async () => {
    let requests = 0;
    const options = await setup((_, response) => {
      requests += 1;
      later(() => respond(response), 1200);
    });
    await waitForInternalServer(options);
    expect(requests).toBe(1);
  });

  it.each([302, 401, 404, 500])('does not accept HTTP %i as readiness', async (status) => {
    let requests = 0;
    const options = await setup((_, response) => {
      requests += 1;
      respond(response, requests === 1 ? status : 200);
    });
    await waitForInternalServer(options);
    expect(requests).toBe(2);
  });

  it.each(['<html>sign in</html>', '{}', '{"version":""}', '{"version":1}'])(
    'rejects misleading HTTP 200 bodies before retrying: %s',
    async (body) => {
      let requests = 0;
      const options = await setup((_, response) => {
        requests += 1;
        respond(response, 200, requests === 1 ? body : undefined);
      });
      await waitForInternalServer(options);
      expect(requests).toBe(2);
    },
  );

  it('bounds the readiness response body', async () => {
    let requests = 0;
    const options = await setup((_, response) => {
      requests += 1;
      respond(response, 200, requests === 1 ? 'x'.repeat(2048) : undefined);
    });
    await waitForInternalServer(options);
    expect(requests).toBe(2);
  });

  it('retries a stalled probe without leaving overlapping requests', async () => {
    let requests = 0;
    let firstClosed = false;
    const options = await setup((request, response) => {
      requests += 1;
      if (requests === 1) {
        request.once('close', () => {
          firstClosed = true;
        });
        return;
      }
      expect(firstClosed).toBe(true);
      respond(response);
    });
    await waitForInternalServer({ ...options, requestTimeoutMs: 50 });
    expect(requests).toBe(2);
  });

  it('fails within a total startup deadline and destroys its active probe', async () => {
    const options = await setup(() => {});
    await expect(waitForInternalServer({ ...options, timeoutMs: 150 })).rejects.toThrow(
      'readiness timed out',
    );
    expect(options.child.listenerCount('exit')).toBe(0);
  });

  it('cancels a probe when the child exits before readiness', async () => {
    const options = await setup(() => {});
    const request = waitForInternalServer(options);
    options.child.emit('exit', 1);
    await expect(request).rejects.toThrow('exited before readiness (1)');
    expect(options.child.listenerCount('exit')).toBe(0);
  });

  it('rejects spawn errors without waiting for the startup deadline', async () => {
    const options = await setup(() => {});
    const request = waitForInternalServer(options);
    options.child.emit('error', new Error('spawn failed'));
    await expect(request).rejects.toThrow('could not be started');
    expect(options.child.listenerCount('error')).toBe(0);
  });

  it('detects an already exited child', async () => {
    const options = await setup(() => {});
    options.child.exitCode = 2;
    await expect(waitForInternalServer(options)).rejects.toThrow('exited before readiness (2)');
  });

  it('does not start a probe when shutdown has already been requested', async () => {
    let requests = 0;
    const options = await setup((_, response) => {
      requests += 1;
      respond(response);
    });
    const controller = new AbortController();
    controller.abort(new Error('shutdown'));
    await expect(waitForInternalServer({ ...options, signal: controller.signal })).rejects.toThrow(
      'shutdown',
    );
    expect(requests).toBe(0);
  });

  it('cancels an in-flight startup probe when the launcher stops', async () => {
    const controller = new AbortController();
    const options = await setup(() => controller.abort(new Error('shutdown')));
    await expect(waitForInternalServer({ ...options, signal: controller.signal })).rejects.toThrow(
      'shutdown',
    );
    expect(options.child.listenerCount('exit')).toBe(0);
  });
});
