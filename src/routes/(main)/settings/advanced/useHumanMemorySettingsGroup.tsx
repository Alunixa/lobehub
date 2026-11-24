'use client';

import type { FormGroupItemType } from '@lobehub/ui';
import { InputNumber, TextArea } from '@lobehub/ui';
import {
  Button,
  confirmModal,
  createModal,
  Switch,
  Text,
  toast,
  useModalContext,
} from '@lobehub/ui/base-ui';
import isEqual from 'fast-deep-equal';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePermission } from '@/hooks/usePermission';
import { userMemoryService } from '@/services/userMemory';
import { useUserStore } from '@/store/user';
import { settingsSelectors } from '@/store/user/selectors';

type CoreMemoryDraft = {
  activeMatters: string | null;
  personaTone: string | null;
  userCore: string | null;
};

const EMPTY_CORE_MEMORY: CoreMemoryDraft = {
  activeMatters: null,
  personaTone: null,
  userCore: null,
};

const CoreMemoryEditor = ({
  initialValue,
  onSave,
}: {
  initialValue: CoreMemoryDraft;
  onSave: (value: CoreMemoryDraft) => Promise<void>;
}) => {
  const { t } = useTranslation('setting');
  const { close } = useModalContext();
  const [value, setValue] = useState<CoreMemoryDraft>(initialValue);
  const [saving, setSaving] = useState(false);

  const update = (key: keyof CoreMemoryDraft, next: string) => {
    setValue((current) => ({ ...current, [key]: next || null }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(value);
      close();
    } catch {
      toast.error(t('tab.advanced.humanMemory.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <TextArea
        autoSize={{ maxRows: 8, minRows: 3 }}
        placeholder={t('tab.advanced.humanMemory.editor.personaTone.placeholder')}
        value={value.personaTone ?? ''}
        onChange={(event) => update('personaTone', event.target.value)}
      />
      <TextArea
        autoSize={{ maxRows: 8, minRows: 3 }}
        placeholder={t('tab.advanced.humanMemory.editor.userCore.placeholder')}
        value={value.userCore ?? ''}
        onChange={(event) => update('userCore', event.target.value)}
      />
      <TextArea
        autoSize={{ maxRows: 8, minRows: 3 }}
        placeholder={t('tab.advanced.humanMemory.editor.activeMatters.placeholder')}
        value={value.activeMatters ?? ''}
        onChange={(event) => update('activeMatters', event.target.value)}
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button onClick={close}>{t('cancel', { ns: 'common' })}</Button>
        <Button loading={saving} type="primary" onClick={() => void handleSave()}>
          {t('save', { ns: 'common' })}
        </Button>
      </div>
    </div>
  );
};

export const useHumanMemorySettingsGroup = (): FormGroupItemType => {
  const { t } = useTranslation('setting');
  const { allowed: canManageMemory } = usePermission('manage_settings');
  const memory = useUserStore(settingsSelectors.currentMemorySettings, isEqual);
  const [setSettings, isUserStateInit] = useUserStore((state) => [
    state.setSettings,
    state.isUserStateInit,
  ]);
  const [loading, setLoading] = useState(false);
  const useFetchHumanMemoryStatus = useUserStore((state) => state.useFetchHumanMemoryStatus);
  const {
    data,
    error,
    isLoading,
    mutate: refreshMemory,
  } = useFetchHumanMemoryStatus(isUserStateInit && memory.humanMemoryEnabled === true);
  const coreMemory = data?.core ?? EMPTY_CORE_MEMORY;
  const episodicCount = data?.count ?? 0;
  const status = data?.core;

  const handleSaveCoreMemory = useCallback(
    async (value: CoreMemoryDraft) => {
      await userMemoryService.updateHumanCoreMemory(value);
      await refreshMemory();
      toast.success(t('tab.advanced.humanMemory.editor.saveSuccess'));
    },
    [refreshMemory, t],
  );

  const handleOpenEditor = useCallback(() => {
    createModal({
      content: <CoreMemoryEditor initialValue={coreMemory} onSave={handleSaveCoreMemory} />,
      footer: null,
      maskClosable: false,
      title: t('tab.advanced.humanMemory.editor.title'),
      width: 'min(92vw, 640px)',
    });
  }, [coreMemory, handleSaveCoreMemory, t]);

  const handleClearEpisodic = useCallback(() => {
    confirmModal({
      cancelText: t('cancel', { ns: 'common' }),
      content: t('tab.advanced.humanMemory.clear.confirm'),
      okButtonProps: { danger: true },
      okText: t('tab.advanced.humanMemory.clear.action'),
      onOk: async () => {
        await userMemoryService.clearHumanEpisodicMemories();
        await refreshMemory();
        toast.success(t('tab.advanced.humanMemory.clear.success'));
      },
      title: t('tab.advanced.humanMemory.clear.title'),
    });
  }, [refreshMemory, t]);

  const updateMemory = useCallback(
    async (value: Partial<typeof memory>) => {
      if (!canManageMemory) return;
      setLoading(true);
      try {
        await setSettings({ memory: value });
        if (value.humanMemoryEnabled) await refreshMemory();
      } catch {
        toast.error(t('tab.advanced.humanMemory.saveFailed'));
      } finally {
        setLoading(false);
      }
    },
    [canManageMemory, refreshMemory, setSettings, t],
  );

  return {
    children: [
      {
        children: (
          <Text type={error || status?.lastExtractionError ? 'warning' : 'secondary'}>
            {error
              ? t('tab.advanced.humanMemory.status.loadFailed')
              : isLoading
                ? t('tab.advanced.humanMemory.status.loading')
                : !memory.humanMemoryEnabled
                  ? t('tab.advanced.humanMemory.status.disabled')
                  : t(
                      status?.lastExtractionError
                        ? 'tab.advanced.humanMemory.status.failed'
                        : 'tab.advanced.humanMemory.status.detail',
                      {
                        mode: t(
                          status?.retrievalMode === 'semantic'
                            ? 'tab.advanced.humanMemory.status.semantic'
                            : 'tab.advanced.humanMemory.status.keyword',
                        ),
                        count: status?.lastRecallCount ?? 0,
                        time: status?.lastExtractionAt
                          ? new Date(status.lastExtractionAt).toLocaleString()
                          : t('tab.advanced.humanMemory.status.never'),
                      },
                    )}
          </Text>
        ),
        desc: t('tab.advanced.humanMemory.status.desc'),
        label: t('tab.advanced.humanMemory.status.title'),
        minWidth: undefined,
      },
      {
        children: (
          <Button
            disabled={!canManageMemory || !memory.humanMemoryEnabled || isLoading || !!error}
            onClick={handleOpenEditor}
          >
            {t('tab.advanced.humanMemory.editor.open')}
          </Button>
        ),
        desc: t('tab.advanced.humanMemory.editor.desc'),
        label: t('tab.advanced.humanMemory.editor.title'),
        minWidth: undefined,
      },
      {
        children: (
          <Button
            danger
            disabled={
              !canManageMemory ||
              !memory.humanMemoryEnabled ||
              episodicCount === 0 ||
              isLoading ||
              !!error
            }
            onClick={handleClearEpisodic}
          >
            {t('tab.advanced.humanMemory.clear.button', { count: episodicCount })}
          </Button>
        ),
        desc: t('tab.advanced.humanMemory.clear.desc'),
        label: t('tab.advanced.humanMemory.clear.label'),
        minWidth: undefined,
      },
      {
        children: (
          <Button
            disabled={!canManageMemory || !memory.humanMemoryEnabled}
            loading={loading || isLoading}
            onClick={() => void refreshMemory()}
          >
            {t('tab.advanced.humanMemory.refresh')}
          </Button>
        ),
        desc: t('tab.advanced.humanMemory.count.desc', { count: episodicCount }),
        label: t('tab.advanced.humanMemory.count.title'),
        minWidth: undefined,
      },
      {
        children: (
          <InputNumber
            disabled={!canManageMemory || !memory.humanMemoryEnabled}
            max={50}
            min={1}
            value={memory.humanMemoryWindowSize ?? 12}
            onChange={(value) =>
              void updateMemory({
                humanMemoryWindowSize:
                  typeof value === 'number' ? Math.min(50, Math.max(1, value)) : 12,
              })
            }
          />
        ),
        desc: t('tab.advanced.humanMemory.windowSize.desc'),
        label: t('tab.advanced.humanMemory.windowSize.title'),
        minWidth: undefined,
      },
      {
        children: (
          <Switch
            checked={memory.humanMemoryEnabled === true}
            disabled={!canManageMemory}
            onChange={(checked) => void updateMemory({ humanMemoryEnabled: checked })}
          />
        ),
        desc: t('tab.advanced.humanMemory.enabled.desc'),
        label: t('tab.advanced.humanMemory.enabled.title'),
        minWidth: undefined,
      },
    ],
    title: t('tab.advanced.humanMemory.title'),
  };
};
