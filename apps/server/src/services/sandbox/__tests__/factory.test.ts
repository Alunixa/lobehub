import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MarketService } from '@/server/services/market';

const baseOptions = {
  marketService: {} as MarketService,
  topicId: 'topic-1',
  userId: 'user-1',
};

describe('sandbox service factory', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('uses the market provider by default', async () => {
    vi.doMock('@/envs/sandbox', () => ({
      sandboxEnv: {},
    }));

    const { createSandboxService } = await import('../factory');
    const service = createSandboxService(baseOptions);

    expect(service.kind).toBe('market');
    expect(service.capabilities).toMatchObject({
      backgroundCommands: true,
      exportFile: true,
      files: true,
      persistentSession: true,
      shell: true,
      skillScripts: true,
    });
  });

  it('uses the onlyboxes provider when configured', async () => {
    vi.doMock('@/envs/app', () => ({
      appEnv: {
        APP_URL: 'https://lobehub.example.com',
      },
    }));
    vi.doMock('@/envs/sandbox', () => ({
      sandboxEnv: {
        ONLYBOXES_BASE_URL: 'https://onlyboxes.example.com',
        ONLYBOXES_JIT_SIGNING_KEY: 'jit-signing-key',
        SANDBOX_PROVIDER: 'onlyboxes',
      },
    }));

    const { createSandboxService } = await import('../factory');
    const service = createSandboxService(baseOptions);

    expect(service.kind).toBe('onlyboxes');
    expect(service.capabilities.languages).toEqual(['python', 'javascript', 'typescript']);
  });

  it('uses the native host executor when configured without calling Market', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: { output: 'host-ok' }, success: true }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.doMock('@/envs/sandbox', () => ({
      sandboxEnv: {
        HOST_EXECUTOR_BASE_URL: 'http://172.17.0.1:3211',
        HOST_EXECUTOR_TOKEN: 'host-executor-token-with-at-least-32-characters',
        SANDBOX_PROVIDER: 'onlyboxes',
      },
    }));

    const { createSandboxService } = await import('../factory');
    const service = createSandboxService({ ...baseOptions, providerKind: 'host' });
    const result = await service.callTool('runCommand', { command: 'uname -a' });

    expect(service.kind).toBe('host');
    expect(result).toEqual({ result: { output: 'host-ok' }, success: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://172.17.0.1:3211/v1/tools/call',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer host-executor-token-with-at-least-32-characters',
        }),
        method: 'POST',
      }),
    );
  });
});
