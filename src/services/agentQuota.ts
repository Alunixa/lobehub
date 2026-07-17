import type {
  ClaudeCodeAccountIdentity,
  ClaudeCodeQuotaReading,
} from '@lobechat/electron-client-ipc';

import { lambdaClient } from '@/libs/trpc/client';

/**
 * Renderer-side service for the account-scoped quota data layer (persisted via
 * the lambda tRPC → server DB). Distinct from `heterogeneousAgentService`, which
 * fetches the *live* quota from the local CLI login over Electron IPC.
 */
class AgentQuotaService {
  /** Persist a live Claude snapshot (identity + readings) captured over IPC. */
  ingestClaudeSnapshot = async (params: {
    identity: ClaudeCodeAccountIdentity;
    readings: ClaudeCodeQuotaReading[];
  }) =>
    lambdaClient.agentQuota.ingestSnapshot.mutate({
      identity: params.identity,
      provider: 'claude-code',
      readings: params.readings.map((r) => ({ ...r, scopeKey: r.scopeKey ?? '' })),
    });

  listAccounts = async () => lambdaClient.agentQuota.listAccounts.query();

  getWindows = async (accountId: string) => lambdaClient.agentQuota.getWindows.query({ accountId });

  listBindings = async (agentId: string) => lambdaClient.agentQuota.listBindings.query({ agentId });

  /** UI "switch account": pin one account for an agent. */
  switchAccount = async (agentId: string, accountId: string) =>
    lambdaClient.agentQuota.switchAccount.mutate({ accountId, agentId });

  bindAccount = async (agentId: string, accountId: string, role: 'pinned' | 'pool' = 'pool') =>
    lambdaClient.agentQuota.bindAccount.mutate({ accountId, agentId, role });
}

export const agentQuotaService = new AgentQuotaService();
