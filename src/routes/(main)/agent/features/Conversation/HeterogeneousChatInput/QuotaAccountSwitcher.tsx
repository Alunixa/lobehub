'use client';

import type { ClaudeCodeQuotaSnapshot } from '@lobechat/electron-client-ipc';
import { Flexbox, Text } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAgentId } from '@/features/ChatInput/hooks/useAgentId';
import { agentQuotaService } from '@/services/agentQuota';

const styles = createStaticStyles(({ css }) => ({
  root: css`
    padding-block-start: 8px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
  `,
}));

type Account = Awaited<ReturnType<typeof agentQuotaService.listAccounts>>[number];
type Binding = Awaited<ReturnType<typeof agentQuotaService.listBindings>>[number];

/**
 * Footer of the Claude Code quota panel: fossilizes the live snapshot into the
 * DB, then lists the persisted provider accounts and lets the user switch
 * (pin) which account the current agent runs on.
 */
const QuotaAccountSwitcher = memo<{ snapshot: ClaudeCodeQuotaSnapshot }>(({ snapshot }) => {
  const { t } = useTranslation('chat');
  const agentId = useAgentId();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [accs, binds] = await Promise.all([
      agentQuotaService.listAccounts(),
      agentId ? agentQuotaService.listBindings(agentId) : Promise.resolve([] as Binding[]),
    ]);
    setAccounts(accs);
    setBindings(binds);
  }, [agentId]);

  // Persist the live reading, then refresh the account list.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (
        snapshot.status === 'ok' &&
        snapshot.identity?.externalAccountId &&
        snapshot.readings?.length
      ) {
        try {
          await agentQuotaService.ingestClaudeSnapshot({
            identity: snapshot.identity,
            readings: snapshot.readings,
          });
        } catch {
          /* persistence is best-effort; still show what's already stored */
        }
      }
      if (!cancelled) await reload().catch(() => {});
    };
    void run();
    return () => {
      cancelled = true;
    };
    // `updatedAt` is the intentional trigger — it changes on every fresh snapshot,
    // whereas identity/readings are new object refs each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.updatedAt, reload]);

  const pinnedId = bindings.find((b) => b.role === 'pinned')?.accountId;

  const handleSwitch = useCallback(
    async (accountId: string) => {
      if (!agentId) return;
      setBusy(true);
      try {
        if (!bindings.some((b) => b.accountId === accountId)) {
          await agentQuotaService.bindAccount(agentId, accountId, 'pool');
        }
        await agentQuotaService.switchAccount(agentId, accountId);
        await reload();
      } finally {
        setBusy(false);
      }
    },
    [agentId, bindings, reload],
  );

  if (accounts.length === 0) return null;

  return (
    <Flexbox className={styles.root} gap={6}>
      <Text strong style={{ fontSize: 12 }}>
        {t('heteroAgent.claudeQuota.accounts')}
      </Text>
      {accounts.map((a) => {
        const active = a.id === pinnedId;
        return (
          <Flexbox horizontal align="center" justify="space-between" key={a.id}>
            <Flexbox gap={0}>
              <Text style={{ fontSize: 12 }}>{a.label || a.email || a.externalAccountId}</Text>
              {a.planTier && (
                <Text style={{ fontSize: 11 }} type="secondary">
                  {a.planTier}
                  {a.rateLimitTier ? ` · ${a.rateLimitTier}` : ''}
                </Text>
              )}
            </Flexbox>
            <Button
              disabled={busy || active}
              size="small"
              type={active ? 'default' : 'primary'}
              onClick={() => void handleSwitch(a.id)}
            >
              {active
                ? t('heteroAgent.claudeQuota.accountActive')
                : t('heteroAgent.claudeQuota.accountSwitch')}
            </Button>
          </Flexbox>
        );
      })}
    </Flexbox>
  );
});

QuotaAccountSwitcher.displayName = 'QuotaAccountSwitcher';

export default QuotaAccountSwitcher;
