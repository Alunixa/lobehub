'use client';

import { isDesktop } from '@lobechat/const';
import { type FormGroupItemType, type FormItemProps } from '@lobehub/ui';
import { Form, Icon, InputNumber, Skeleton } from '@lobehub/ui';
import { Select, Switch, toast } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import isEqual from 'fast-deep-equal';
import { Loader2Icon } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import { FORM_STYLE } from '@/const/layoutTokens';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';
import { autoUpdateService } from '@/services/electron/autoUpdate';
import { serverConfigSelectors, useServerConfigStore } from '@/store/serverConfig';
import { useUserStore } from '@/store/user';
import { labPreferSelectors, preferenceSelectors, settingsSelectors } from '@/store/user/selectors';

import { useMemoryEmbeddingSettingsGroup } from './useMemoryEmbeddingSettingsGroup';
import { useMemoryTextModelSettingsGroup } from './useMemoryTextModelSettingsGroup';

type UpdateChannelValue = 'canary' | 'stable';

const styles = createStaticStyles(({ css }) => ({
  labItem: css`
    .ant-form-item-row {
      align-items: center !important;
    }
  `,
}));

const Page = memo(() => {
  const { t } = useTranslation('setting');
  const { t: tLabs } = useTranslation('labs');

  const general = useUserStore((s) => settingsSelectors.currentSettings(s).general, isEqual);
  const defaultAgentGatewayModeEnabled = useUserStore(
    (s) => settingsSelectors.defaultAgentConfig(s).chatConfig?.disableGatewayMode !== true,
  );
  const [setSettings, updateDefaultAgent, isUserStateInit, isUserStateInitError, refreshUserState] =
    useUserStore((s) => [
      s.setSettings,
      s.updateDefaultAgent,
      s.isUserStateInit,
      s.isUserStateInitError,
      s.refreshUserState,
    ]);
  const [loading, setLoading] = useState(false);
  const enableTopicReference = general.enableTopicReference ?? false;
  const enableProactiveTopicReading = general.enableProactiveTopicReading ?? false;
  const proactiveTopicReadingCount = general.proactiveTopicReadingCount ?? 10;

  const [
    isPreferenceInit,
    enableAgentDocumentFloatingChatPanel,
    enableInputMarkdown,
    enablePlatformAgent,
    enableImessage,
    enableFleet,
    enableTaskVerify,
    enableFoldFinishedTurn,
    updateLab,
  ] = useUserStore((s) => [
    preferenceSelectors.isPreferenceInit(s),
    labPreferSelectors.enableAgentDocumentFloatingChatPanel(s),
    labPreferSelectors.enableInputMarkdown(s),
    labPreferSelectors.enablePlatformAgent(s),
    labPreferSelectors.enableImessage(s),
    labPreferSelectors.enableFleet(s),
    labPreferSelectors.enableTaskVerify(s),
    labPreferSelectors.enableFoldFinishedTurn(s),
    s.updateLab,
  ]);

  const enableGatewayMode = useServerConfigStore(serverConfigSelectors.enableGatewayMode);
  const hasGatewayUrl = useServerConfigStore((s) => !!s.serverConfig.agentGatewayUrl);

  const [channel, setChannel] = useState<UpdateChannelValue>('stable');
  const [automaticUpdatesEnabled, setAutomaticUpdatesEnabled] = useState(false);
  const [automaticUpdatesLoading, setAutomaticUpdatesLoading] = useState(true);
  const memoryEmbeddingGroup = useMemoryEmbeddingSettingsGroup();
  const memoryTextModelGroup = useMemoryTextModelSettingsGroup();

  useEffect(() => {
    if (!isDesktop) return;
    Promise.all([
      autoUpdateService.getUpdateChannel(),
      autoUpdateService.getAutomaticUpdatesEnabled(),
    ])
      .then(([storedChannel, enabled]) => {
        setChannel(storedChannel);
        setAutomaticUpdatesEnabled(enabled);
      })
      .catch((error) => {
        console.error('Failed to load desktop update settings:', error);
        toast.error(t('tab.advanced.automaticUpdates.loadError'));
      })
      .finally(() => setAutomaticUpdatesLoading(false));
  }, [t]);

  const handleChannelChange = useCallback((value: UpdateChannelValue) => {
    setChannel(value);
    autoUpdateService.setUpdateChannel(value);
  }, []);

  const handleAutomaticUpdatesChange = useCallback(
    async (enabled: boolean) => {
      setAutomaticUpdatesLoading(true);
      try {
        await autoUpdateService.setAutomaticUpdatesEnabled(enabled);
        setAutomaticUpdatesEnabled(enabled);
      } catch (error) {
        console.error('Failed to save automatic update setting:', error);
        toast.error(t('tab.advanced.automaticUpdates.saveError'));
      } finally {
        setAutomaticUpdatesLoading(false);
      }
    },
    [t],
  );

  const handleGatewayModeChange = useCallback(
    (checked: boolean) => {
      updateDefaultAgent({
        config: { chatConfig: { disableGatewayMode: checked ? false : true } },
      });
    },
    [updateDefaultAgent],
  );

  const handleTopicReadingSettingChange = useCallback(
    async (value: Partial<typeof general>) => {
      await setSettings({ general: value });
    },
    [setSettings],
  );

  if (!isUserStateInit) {
    // A failed user-state init must show error + Retry, not a permanent skeleton
    // (LOBE-11139).
    if (isUserStateInitError)
      return (
        <AsyncError
          error={isUserStateInitError}
          variant={'block'}
          onRetry={() => refreshUserState()}
        />
      );
    return <Skeleton active paragraph={{ rows: 5 }} title={false} />;
  }

  const advancedGroup: FormGroupItemType = {
    children: [
      {
        children: <Switch />,
        desc: t('settingCommon.devMode.desc'),
        label: t('settingCommon.devMode.title'),
        minWidth: undefined,
        name: 'isDevMode',
        valuePropName: 'checked',
      },
      ...(enableGatewayMode
        ? [
            {
              children: (
                <Switch
                  checked={defaultAgentGatewayModeEnabled}
                  onChange={handleGatewayModeChange}
                />
              ),
              className: styles.labItem,
              desc: t('tab.advanced.gatewayMode.desc'),
              label: t('tab.advanced.gatewayMode.title'),
              minWidth: undefined,
            } satisfies FormItemProps,
          ]
        : []),
    ],
    extra: loading && <Icon spin icon={Loader2Icon} size={16} style={{ opacity: 0.5 }} />,
    title: t('tab.advanced.toolsAndDiagnostics.title'),
  };

  const channelOptions = [
    { label: t('tab.advanced.updateChannel.stable'), value: 'stable' as const },
    { label: t('tab.advanced.updateChannel.canary'), value: 'canary' as const },
  ];

  const updateChannelGroup: FormGroupItemType = {
    children: [
      {
        children: (
          <Switch
            checked={automaticUpdatesEnabled}
            loading={automaticUpdatesLoading}
            onChange={handleAutomaticUpdatesChange}
          />
        ),
        desc: t('tab.advanced.automaticUpdates.desc'),
        label: t('tab.advanced.automaticUpdates.title'),
        minWidth: undefined,
      },
      {
        children: (
          <Select options={channelOptions} value={channel} onChange={handleChannelChange} />
        ),
        desc: t('tab.advanced.updateChannel.desc'),
        label: t('tab.advanced.updateChannel.title'),
      },
    ],
    title: t('tab.advanced.appUpdates.title'),
  };

  const conversationReadingGroup: FormGroupItemType = {
    children: [
      {
        children: (
          <Switch
            checked={enableTopicReference}
            onChange={(checked) =>
              void handleTopicReadingSettingChange({ enableTopicReference: checked })
            }
          />
        ),
        desc: t('tab.advanced.conversationReading.reference.desc'),
        label: t('tab.advanced.conversationReading.reference.title'),
        minWidth: undefined,
      },
      {
        children: (
          <Switch
            checked={enableProactiveTopicReading}
            onChange={(checked) =>
              void handleTopicReadingSettingChange({ enableProactiveTopicReading: checked })
            }
          />
        ),
        desc: t('tab.advanced.conversationReading.proactive.desc'),
        label: t('tab.advanced.conversationReading.proactive.title'),
        minWidth: undefined,
      },
      ...(enableProactiveTopicReading
        ? [
            {
              children: (
                <Select
                  value={proactiveTopicReadingCount === 'auto' ? 'auto' : 'custom'}
                  options={[
                    {
                      label: t('tab.advanced.conversationReading.count.auto'),
                      value: 'auto',
                    },
                    {
                      label: t('tab.advanced.conversationReading.count.custom'),
                      value: 'custom',
                    },
                  ]}
                  onChange={(value) =>
                    void handleTopicReadingSettingChange({
                      proactiveTopicReadingCount: value === 'auto' ? 'auto' : 10,
                    })
                  }
                />
              ),
              desc: t('tab.advanced.conversationReading.count.desc'),
              label: t('tab.advanced.conversationReading.count.title'),
            } satisfies FormItemProps,
            ...(proactiveTopicReadingCount !== 'auto'
              ? [
                  {
                    children: (
                      <InputNumber
                        max={25}
                        min={1}
                        value={proactiveTopicReadingCount}
                        onChange={(value) => {
                          const nextValue = typeof value === 'number' ? value : 10;
                          void handleTopicReadingSettingChange({
                            proactiveTopicReadingCount: Math.min(25, Math.max(1, nextValue)),
                          });
                        }}
                      />
                    ),
                    desc: t('tab.advanced.conversationReading.customCount.desc'),
                    label: t('tab.advanced.conversationReading.customCount.title'),
                  } satisfies FormItemProps,
                ]
              : []),
          ]
        : []),
    ],
    title: t('tab.advanced.conversationReading.title'),
  };

  const labItems: FormItemProps[] = [
    {
      children: (
        <Switch
          checked={enableAgentDocumentFloatingChatPanel}
          loading={!isPreferenceInit}
          onChange={(checked) => updateLab({ enableAgentDocumentFloatingChatPanel: checked })}
        />
      ),
      className: styles.labItem,
      desc: tLabs('features.agentDocumentFloatingChatPanel.desc'),
      label: tLabs('features.agentDocumentFloatingChatPanel.title'),
      minWidth: undefined,
    },
    {
      children: (
        <Switch
          checked={enableInputMarkdown}
          loading={!isPreferenceInit}
          onChange={(checked) => updateLab({ enableInputMarkdown: checked })}
        />
      ),
      className: styles.labItem,
      desc: tLabs('features.inputMarkdown.desc'),
      label: tLabs('features.inputMarkdown.title'),
      minWidth: undefined,
    },
    {
      children: (
        <Switch
          checked={enableTaskVerify}
          loading={!isPreferenceInit}
          onChange={(checked) => updateLab({ enableTaskVerify: checked })}
        />
      ),
      className: styles.labItem,
      desc: tLabs('features.taskVerify.desc'),
      label: tLabs('features.taskVerify.title'),
      minWidth: undefined,
    },
    {
      children: (
        <Switch
          checked={enableFoldFinishedTurn}
          loading={!isPreferenceInit}
          onChange={(checked) => updateLab({ enableFoldFinishedTurn: checked })}
        />
      ),
      className: styles.labItem,
      desc: tLabs('features.foldFinishedTurn.desc'),
      label: tLabs('features.foldFinishedTurn.title'),
      minWidth: undefined,
    },
    ...(isDesktop
      ? [
          {
            children: (
              <Switch
                checked={enableImessage}
                loading={!isPreferenceInit}
                onChange={(checked: boolean) => updateLab({ enableImessage: checked })}
              />
            ),
            className: styles.labItem,
            desc: tLabs('features.imessage.desc'),
            label: tLabs('features.imessage.title'),
            minWidth: undefined,
          } satisfies FormItemProps,
          {
            children: (
              <Switch
                checked={enableFleet}
                loading={!isPreferenceInit}
                onChange={(checked: boolean) => updateLab({ enableFleet: checked })}
              />
            ),
            className: styles.labItem,
            desc: tLabs('features.fleet.desc'),
            label: tLabs('features.fleet.title'),
            minWidth: undefined,
          } satisfies FormItemProps,
        ]
      : []),
    ...(hasGatewayUrl
      ? [
          {
            children: (
              <Switch
                checked={enablePlatformAgent}
                loading={!isPreferenceInit}
                onChange={(checked: boolean) => updateLab({ enablePlatformAgent: checked })}
              />
            ),
            className: styles.labItem,
            desc: tLabs('features.platformAgent.desc'),
            label: tLabs('features.platformAgent.title'),
            minWidth: undefined,
          } satisfies FormItemProps,
        ]
      : []),
  ];

  const labsGroup: FormGroupItemType = {
    children: labItems,
    title: tLabs('title'),
  };

  const items = isDesktop
    ? [
        advancedGroup,
        conversationReadingGroup,
        updateChannelGroup,
        memoryEmbeddingGroup,
        memoryTextModelGroup,
        labsGroup,
      ]
    : [
        advancedGroup,
        conversationReadingGroup,
        memoryEmbeddingGroup,
        memoryTextModelGroup,
        labsGroup,
      ];

  return (
    <>
      <SettingHeader title={t('tab.advanced')} />
      <Form
        collapsible={false}
        initialValues={general}
        items={items}
        itemsType={'group'}
        variant={'filled'}
        onValuesChange={async (v) => {
          setLoading(true);
          await setSettings({ general: v });
          setLoading(false);
        }}
        {...FORM_STYLE}
      />
    </>
  );
});

export default Page;
