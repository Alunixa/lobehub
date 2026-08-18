import type { SandboxCallToolResult } from '@lobechat/builtin-tool-cloud-sandbox';
import debug from 'debug';

import { sandboxEnv } from '@/envs/sandbox';

import type {
  SandboxProvider,
  SandboxProviderCapabilities,
  SandboxProviderFileExportRequest,
  SandboxProviderFileExportResult,
  SandboxServiceOptions,
} from '../types';

const log = debug('lobe-server:sandbox:host');
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Explicitly unsandboxed backend. Execution is delegated to the native
 * lobe-host-executor daemon on the Docker host, never to the LobeHub container.
 */
export class HostSandboxProvider implements SandboxProvider {
  readonly capabilities = {
    backgroundCommands: true,
    exportFile: true,
    files: true,
    languages: ['python', 'javascript', 'typescript'],
    persistentSession: true,
    shell: true,
    skillScripts: true,
  } as const satisfies SandboxProviderCapabilities;

  readonly kind = 'host';

  private readonly baseUrl: string;
  private readonly token: string;

  constructor(private readonly options: SandboxServiceOptions) {
    this.baseUrl = (sandboxEnv.HOST_EXECUTOR_BASE_URL || '').replace(/\/+$/, '');
    this.token = sandboxEnv.HOST_EXECUTOR_TOKEN || '';
  }

  async callTool(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<SandboxCallToolResult> {
    if (!this.baseUrl || !this.token) return this.missingConfig();

    try {
      return await this.request<SandboxCallToolResult>('/v1/tools/call', {
        params,
        toolName,
        topicId: this.options.topicId,
        userId: this.options.userId,
      });
    } catch (error) {
      log('Host executor tool %s failed: %O', toolName, error);
      return this.errorResult((error as Error).message, (error as Error).name);
    }
  }

  async exportFileToUploadUrl(
    request: SandboxProviderFileExportRequest,
  ): Promise<SandboxProviderFileExportResult> {
    if (!this.baseUrl || !this.token) {
      return {
        error: { message: 'HOST_EXECUTOR_BASE_URL and HOST_EXECUTOR_TOKEN are required' },
        success: false,
      };
    }

    try {
      return await this.request<SandboxProviderFileExportResult>('/v1/files/export', {
        ...request,
        topicId: this.options.topicId,
        userId: this.options.userId,
      });
    } catch (error) {
      log('Host executor export failed: %O', error);
      return { error: { message: (error as Error).message }, success: false };
    }
  }

  private async request<T>(pathname: string, body: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}${pathname}`, {
        body: JSON.stringify(body),
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: controller.signal,
      });
      const text = await response.text();
      const json = text ? JSON.parse(text) : {};
      if (!response.ok) {
        const message =
          typeof json?.error?.message === 'string'
            ? json.error.message
            : `Host executor request failed with HTTP ${response.status}`;
        throw new Error(message);
      }
      return json as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private missingConfig(): SandboxCallToolResult {
    return this.errorResult('HOST_EXECUTOR_BASE_URL and HOST_EXECUTOR_TOKEN are required');
  }

  private errorResult(message: string, name?: string): SandboxCallToolResult {
    return { error: { message, name }, result: null, success: false };
  }
}
