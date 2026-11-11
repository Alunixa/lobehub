/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('node:http');

const INTERNAL_READY_PATH = '/api/version';
const STARTUP_TIMEOUT_MS = 180_000;
const PROBE_TIMEOUT_MS = 10_000;
const MAX_VERSION_BYTES = 1024;

const waitForInternalServer = ({
  child,
  internalHost,
  internalPort,
  requestTimeoutMs = PROBE_TIMEOUT_MS,
  signal,
  timeoutMs = STARTUP_TIMEOUT_MS,
}) =>
  new Promise((resolve, reject) => {
    let settled = false;
    let attempts = 0;
    let lastStatus = 'unavailable';
    let retryTimer;
    let deadlineTimer;
    let activeRequest;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(retryTimer);
      clearTimeout(deadlineTimer);
      child.off('exit', onExit);
      child.off('error', onError);
      signal?.removeEventListener('abort', onAbort);
      activeRequest?.destroy();
      if (error) reject(error);
      else resolve();
    };
    const onExit = (code, exitSignal) =>
      finish(new Error(`Internal Next server exited before readiness (${code ?? exitSignal})`));
    const onError = () => finish(new Error('Internal Next server could not be started'));
    const onAbort = () => finish(signal.reason || new Error('Server startup cancelled'));
    const retry = () => {
      if (settled || retryTimer) return;
      retryTimer = setTimeout(
        () => {
          retryTimer = undefined;
          probe();
        },
        Math.min(1000, 100 + attempts * 25),
      );
    };
    const probe = () => {
      if (settled) return;
      attempts += 1;
      const request = http.get(
        { hostname: internalHost, path: INTERNAL_READY_PATH, port: internalPort },
        (response) => {
          let body = '';
          let bytes = 0;
          lastStatus = String(response.statusCode);
          response.setEncoding('utf8');
          response.on('data', (chunk) => {
            bytes += Buffer.byteLength(chunk);
            if (bytes > MAX_VERSION_BYTES) {
              request.destroy();
              retry();
              return;
            }
            body += chunk;
          });
          response.on('error', retry);
          response.once('end', () => {
            if (response.statusCode === 200) {
              try {
                const version = JSON.parse(body)?.version;
                if (typeof version === 'string' && version.trim()) {
                  finish();
                  return;
                }
              } catch {
                // An HTML error or incomplete JSON response is not readiness.
              }
            }
            retry();
          });
        },
      );
      activeRequest = request;
      request.setTimeout(requestTimeoutMs, () => {
        request.destroy();
        retry();
      });
      request.on('error', retry);
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }
    if (child.exitCode !== null && child.exitCode !== undefined) {
      onExit(child.exitCode);
      return;
    }
    if (child.signalCode) {
      onExit(null, child.signalCode);
      return;
    }
    child.once('exit', onExit);
    child.once('error', onError);
    signal?.addEventListener('abort', onAbort, { once: true });
    deadlineTimer = setTimeout(
      () =>
        finish(
          new Error(
            `Internal Next server readiness timed out after ${timeoutMs}ms (${attempts} probes, last status ${lastStatus})`,
          ),
        ),
      timeoutMs,
    );
    probe();
  });

module.exports = { waitForInternalServer };
