import type { FormGroupItemType } from '@lobehub/ui';
import { Input, InputPassword } from '@lobehub/ui';
import { Button, Switch, toast } from '@lobehub/ui/base-ui';
import isEqual from 'fast-deep-equal';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { userMemoryService } from '@/services/userMemory';
import { useUserStore } from '@/store/user';
import { settingsSelectors } from '@/store/user/selectors';

interface MemoryTextModelDraft {
  apiKey: string;
  baseURL: string;
  enabled: boolean;
  model: string;
}

const INPUT_STYLE = { width: 360 };

export const useMemoryTextModelSettingsGroup = (): FormGroupItemType => {
  const { t } = useTranslation('setting');
  const textModel = useUserStore(
    (state) => settingsSelectors.currentMemorySettings(state).textModel,
    isEqual,
  );
  const keyVault = useUserStore(
    (state) => settingsSelectors.currentSettings(state).keyVaults.memoryTextModel,
    isEqual,
  );
  const setSettings = useUserStore((state) => state.setSettings);
  const [draft, setDraft] = useState<MemoryTextModelDraft>({
    apiKey: keyVault?.apiKey || '',
    baseURL: keyVault?.baseURL || '',
    enabled: textModel?.enabled === true,
    model: textModel?.model || '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft({
      apiKey: keyVault?.apiKey || '',
      baseURL: keyVault?.baseURL || '',
      enabled: textModel?.enabled === true,
      model: textModel?.model || '',
    });
  }, [keyVault, textModel]);

  const updateDraft = useCallback(
    (value: Partial<MemoryTextModelDraft>) =>
      setDraft((current) => ({
        ...current,
        ...value,
      })),
    [],
  );

  const handleSave = useCallback(async () => {
    const apiKey = draft.apiKey.trim();
    const baseURL = draft.baseURL
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/(?:chat\/completions|responses)$/i, '');
    const model = draft.model.trim();

    if (draft.enabled) {
      if (!baseURL || !apiKey || !model) {
        toast.error(t('tab.advanced.memoryTextModel.validation.required'));
        return;
      }

      try {
        const url = new URL(baseURL);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw new Error('Unsupported memory text model URL protocol');
        }
      } catch {
        toast.error(t('tab.advanced.memoryTextModel.validation.baseURL'));
        return;
      }
    }

    setSaving(true);
    try {
      if (draft.enabled) {
        await userMemoryService.testMemoryModelConnection({
          apiKey,
          baseURL,
          model,
          type: 'text',
        });
      }
      await setSettings({
        keyVaults: {
          memoryTextModel: { apiKey, baseURL },
        },
        memory: {
          textModel: { enabled: draft.enabled, model },
        },
      });
      toast.success(t('tab.advanced.memoryTextModel.saveSuccess'));
    } catch (error) {
      console.error('Failed to verify or save memory text model settings:', error);
      toast.error(t('tab.advanced.memoryTextModel.saveError'));
    } finally {
      setSaving(false);
    }
  }, [draft, setSettings, t]);

  return {
    children: [
      {
        children: (
          <Switch checked={draft.enabled} onChange={(enabled) => updateDraft({ enabled })} />
        ),
        desc: t('tab.advanced.memoryTextModel.enabled.desc'),
        label: t('tab.advanced.memoryTextModel.enabled.title'),
        minWidth: undefined,
      },
      ...(draft.enabled
        ? [
            {
              children: (
                <Input
                  placeholder={'https://api.example.com/v1'}
                  style={INPUT_STYLE}
                  value={draft.baseURL}
                  onChange={(event) => updateDraft({ baseURL: event.target.value })}
                />
              ),
              desc: t('tab.advanced.memoryTextModel.baseURL.desc'),
              label: t('tab.advanced.memoryTextModel.baseURL.title'),
            },
            {
              children: (
                <InputPassword
                  autoComplete={'off'}
                  style={INPUT_STYLE}
                  value={draft.apiKey}
                  onChange={(event) => updateDraft({ apiKey: event.target.value })}
                />
              ),
              desc: t('tab.advanced.memoryTextModel.apiKey.desc'),
              label: t('tab.advanced.memoryTextModel.apiKey.title'),
            },
            {
              children: (
                <Input
                  placeholder={'gpt-4.1-mini'}
                  style={INPUT_STYLE}
                  value={draft.model}
                  onChange={(event) => updateDraft({ model: event.target.value })}
                />
              ),
              desc: t('tab.advanced.memoryTextModel.model.desc'),
              label: t('tab.advanced.memoryTextModel.model.title'),
            },
          ]
        : []),
    ],
    extra: (
      <Button loading={saving} type={'primary'} onClick={handleSave}>
        {t('tab.advanced.memoryTextModel.save')}
      </Button>
    ),
    title: t('tab.advanced.memoryTextModel.title'),
  };
};
