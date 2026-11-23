// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('server instrumentation startup', () => {
  const ensureGatewayRunning = vi.fn();
  const loadGateway = vi.fn();
  const startProactiveDispatcher = vi.fn();
  const startTaskDispatcher = vi.fn();
  let releaseGatewayImport: () => void;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('DATABASE_URL', 'postgresql://startup-fixture');
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('ENABLE_TELEMETRY', '');
    ensureGatewayRunning.mockReset().mockResolvedValue(undefined);
    loadGateway.mockReset();
    startProactiveDispatcher.mockReset();
    startTaskDispatcher.mockReset().mockResolvedValue(undefined);
    const gatewayImport = new Promise<void>((resolve) => {
      releaseGatewayImport = resolve;
    });
    vi.doMock('@/server/services/gateway', async () => {
      loadGateway();
      await gatewayImport;
      return {
        GatewayService: class {
          ensureRunning = ensureGatewayRunning;
        },
      };
    });
    vi.doMock('@/server/services/proactiveConversation/dispatch', () => ({
      startProactiveConversationDispatcher: startProactiveDispatcher,
    }));
    vi.doMock('@/server/services/taskScheduler/localDispatcher', () => ({
      startLocalTaskDispatcher: startTaskDispatcher,
    }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    releaseGatewayImport();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('finishes registration before loading background modules', async () => {
    const { register } = await import('./instrumentation');
    let ready = false;
    const registration = register().then(() => {
      ready = true;
    });
    await Promise.resolve();

    expect(ready).toBe(true);
    expect(loadGateway).not.toHaveBeenCalled();
    await registration;
  });

  it('starts dispatchers even while the gateway module is still loading', async () => {
    const { register } = await import('./instrumentation');
    await register();
    await vi.advanceTimersByTimeAsync(1);

    expect(loadGateway).toHaveBeenCalledOnce();
    expect(ensureGatewayRunning).not.toHaveBeenCalled();
    expect(startProactiveDispatcher).toHaveBeenCalledOnce();
    expect(startTaskDispatcher).toHaveBeenCalledOnce();

    releaseGatewayImport();
    await vi.dynamicImportSettled();
    expect(ensureGatewayRunning).toHaveBeenCalledOnce();
  });

  it('contains a dispatcher failure without disabling the other services', async () => {
    const failure = new Error('fixture dispatcher failure');
    startProactiveDispatcher.mockImplementation(() => {
      throw failure;
    });
    const { register } = await import('./instrumentation');
    await register();
    releaseGatewayImport();
    await vi.advanceTimersByTimeAsync(1);
    await vi.dynamicImportSettled();

    expect(console.error).toHaveBeenCalledWith(
      '[Instrumentation] Failed to start proactive conversation dispatcher:',
      failure,
    );
    expect(ensureGatewayRunning).toHaveBeenCalledOnce();
    expect(startTaskDispatcher).toHaveBeenCalledOnce();
  });

  it('contains a rejected asynchronous gateway startup', async () => {
    const failure = new Error('fixture gateway failure');
    ensureGatewayRunning.mockRejectedValue(failure);
    const { register } = await import('./instrumentation');
    await register();
    releaseGatewayImport();
    await vi.advanceTimersByTimeAsync(1);
    await vi.dynamicImportSettled();

    expect(console.error).toHaveBeenCalledWith(
      '[Instrumentation] Failed to start GatewayManager:',
      failure,
    );
    expect(startTaskDispatcher).toHaveBeenCalledOnce();
  });

  it('does not schedule services twice when registration is repeated', async () => {
    const { register } = await import('./instrumentation');
    await register();
    await register();
    releaseGatewayImport();
    await vi.advanceTimersByTimeAsync(1);
    await vi.dynamicImportSettled();

    expect(ensureGatewayRunning).toHaveBeenCalledOnce();
    expect(startProactiveDispatcher).toHaveBeenCalledOnce();
    expect(startTaskDispatcher).toHaveBeenCalledOnce();
  });

  it.each([
    ['NEXT_RUNTIME', 'edge'],
    ['VERCEL_ENV', 'production'],
    ['DATABASE_URL', ''],
  ])('skips persistent services when %s=%s', async (name, value) => {
    vi.stubEnv(name, value);
    const { register } = await import('./instrumentation');
    await register();
    await vi.advanceTimersByTimeAsync(1);

    expect(loadGateway).not.toHaveBeenCalled();
    expect(startProactiveDispatcher).not.toHaveBeenCalled();
    expect(startTaskDispatcher).not.toHaveBeenCalled();
  });
});
