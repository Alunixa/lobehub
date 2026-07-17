'use client';

import type { LobeAgentAgencyConfig } from '@lobechat/types';
import { Flexbox, Icon, Text } from '@lobehub/ui';
import { Select, Switch } from '@lobehub/ui/base-ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { MonitorSmartphone } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import { lambdaQuery } from '@/libs/trpc/client';
import { useAgentStore } from '@/store/agent';

const styles = createStaticStyles(({ css }) => ({
  card: css`
    padding: 16px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};
    background: ${cssVar.colorBgContainer};
  `,
  description: css`
    font-size: 12px;
    line-height: 1.5;
    color: ${cssVar.colorTextDescription};
  `,
  row: css`
    min-height: 44px;
  `,
  title: css`
    font-size: 14px;
    font-weight: 500;
  `,
}));

interface WorkspaceAgentDevicePolicyProps {
  agentId: string;
  showDevicePicker?: boolean;
}

const WorkspaceAgentDevicePolicy = memo<WorkspaceAgentDevicePolicyProps>(
  ({ agentId, showDevicePicker = true }) => {
    const { t } = useTranslation('setting');
    const config = useAgentStore((s) => s.agentMap[agentId]);
    const updateAgentConfigById = useAgentStore((s) => s.updateAgentConfigById);
    const [saving, setSaving] = useState(false);

    const {
      data: devices,
      error,
      isLoading,
      refetch,
    } = lambdaQuery.device.listDevices.useQuery(undefined, { staleTime: 30_000 });

    const publicWorkspaceDevices = useMemo(
      () =>
        (devices ?? []).filter(
          (device) => device.scope === 'workspace' && device.visibility === 'public',
        ),
      [devices],
    );
    const boundDevice = publicWorkspaceDevices.find(
      (device) => device.deviceId === config?.agencyConfig?.boundDeviceId,
    );
    const isFixed = config?.agencyConfig?.deviceSelectionPolicy === 'fixed';

    const saveAgencyConfig = useCallback(
      async (patch: Partial<LobeAgentAgencyConfig>) => {
        setSaving(true);
        try {
          await updateAgentConfigById(agentId, {
            agencyConfig: { ...config?.agencyConfig, ...patch },
          });
        } finally {
          setSaving(false);
        }
      },
      [agentId, config?.agencyConfig, updateAgentConfigById],
    );

    if (!config?.workspaceId) return null;

    return (
      <Flexbox className={styles.card} gap={14}>
        <Flexbox horizontal align={'center'} gap={8}>
          <Icon icon={MonitorSmartphone} size={16} />
          <Text className={styles.title}>{t('settingAgent.devicePolicy.title')}</Text>
        </Flexbox>

        {error ? (
          <AsyncError error={error} variant={'inline'} onRetry={() => void refetch()} />
        ) : (
          <>
            {showDevicePicker && (
              <Flexbox gap={6}>
                <Text>{t('settingAgent.devicePolicy.defaultDevice')}</Text>
                <Select
                  disabled={saving}
                  loading={isLoading}
                  placeholder={t('settingAgent.devicePolicy.selectDevice')}
                  value={boundDevice?.deviceId}
                  options={publicWorkspaceDevices.map((device) => ({
                    label: `${device.friendlyName || device.hostname || device.deviceId} · ${t(
                      device.online
                        ? 'settingAgent.devicePolicy.online'
                        : 'settingAgent.devicePolicy.offline',
                    )}`,
                    value: device.deviceId,
                  }))}
                  onChange={(deviceId) =>
                    void saveAgencyConfig({
                      boundDeviceId: deviceId,
                      executionTarget: 'device',
                    })
                  }
                />
                <Text className={styles.description}>
                  {publicWorkspaceDevices.length === 0 && !isLoading
                    ? t('settingAgent.devicePolicy.noPublicDevice')
                    : t('settingAgent.devicePolicy.defaultDeviceDesc')}
                </Text>
              </Flexbox>
            )}

            <Flexbox horizontal align={'center'} className={styles.row} gap={16}>
              <Flexbox flex={1} gap={4}>
                <Text>{t('settingAgent.devicePolicy.fixed')}</Text>
                <Text className={styles.description}>
                  {isFixed
                    ? t('settingAgent.devicePolicy.fixedDesc')
                    : t('settingAgent.devicePolicy.memberDesc')}
                </Text>
              </Flexbox>
              <Switch
                checked={isFixed}
                // Turning the policy OFF must stay possible even when the
                // bound device has been removed or made non-public (stale
                // `boundDeviceId`); only enabling fixed requires a selectable
                // public bound device.
                disabled={saving || isLoading || (!isFixed && !boundDevice)}
                onChange={(checked) =>
                  void saveAgencyConfig({
                    deviceSelectionPolicy: checked ? 'fixed' : 'member',
                    ...(checked
                      ? { boundDeviceId: boundDevice?.deviceId, executionTarget: 'device' }
                      : {}),
                  })
                }
              />
            </Flexbox>
          </>
        )}
      </Flexbox>
    );
  },
);

WorkspaceAgentDevicePolicy.displayName = 'WorkspaceAgentDevicePolicy';

export default WorkspaceAgentDevicePolicy;
