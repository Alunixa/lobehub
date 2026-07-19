import type { FormGroupItemType } from '@lobehub/ui';
import { Input, InputPassword } from '@lobehub/ui';
import { Button, Switch, toast } from '@lobehub/ui/base-ui';
import isEqual from 'fast-deep-equal';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useUserStore } from '@/store/user';
import { settingsSelectors } from '@/store/user/selectors';

interface MemoryEmbeddingDraft {
  apiKey: string;
  baseURL: string;
  enabled: boolean;
  model: string;
}

const INPUT_STYLE = { width: 360 };

export const useMemoryEmbeddingSettingsGroup = (): FormGroupItemType => {
  const { t } = useTranslation('setting');
  const embedding = useUserStore(
    (state) => settingsSelectors.currentMemorySettings(state).embedding,
    isEqual,
  );
  const keyVault = useUserStore(
    (state) => settingsSelectors.currentSettings(state).keyVaults.memoryEmbedding,
    isEqual,
  );
  const setSettings = useUserStore((state) => state.setSettings);
  const [draft, setDraft] = useState<MemoryEmbeddingDraft>({
    apiKey: keyVault?.apiKey || '',
    baseURL: keyVault?.baseURL || '',
    enabled: embedding?.enabled === true,
    model: embedding?.model || '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft({
      apiKey: keyVault?.apiKey || '',
      baseURL: keyVault?.baseURL || '',
      enabled: embedding?.enabled === true,
      model: embedding?.model || '',
    });
  }, [embedding, keyVault]);

  const updateDraft = useCallback(
    (value: Partial<MemoryEmbeddingDraft>) =>
      setDraft((current) => ({
        ...current,
        ...value,
      })),
    [],
  );

  const handleSave = useCallback(async () => {
    const apiKey = draft.apiKey.trim();
    const baseURL = draft.baseURL.trim();
    const model = draft.model.trim();

    if (draft.enabled) {
      if (!baseURL || !apiKey || !model) {
        toast.error(t('tab.advanced.memoryEmbedding.validation.required'));
        return;
      }

      try {
        const url = new URL(baseURL);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw new Error('Unsupported memory embedding URL protocol');
        }
      } catch {
        toast.error(t('tab.advanced.memoryEmbedding.validation.baseURL'));
        return;
      }
    }

    setSaving(true);
    try {
      await setSettings({
        keyVaults: {
          memoryEmbedding: { apiKey, baseURL },
        },
        memory: {
          embedding: { enabled: draft.enabled, model },
        },
      });
      toast.success(t('tab.advanced.memoryEmbedding.saveSuccess'));
    } catch (error) {
      console.error('Failed to save memory embedding settings:', error);
      toast.error(t('tab.advanced.memoryEmbedding.saveError'));
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
        desc: t('tab.advanced.memoryEmbedding.enabled.desc'),
        label: t('tab.advanced.memoryEmbedding.enabled.title'),
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
              desc: t('tab.advanced.memoryEmbedding.baseURL.desc'),
              label: t('tab.advanced.memoryEmbedding.baseURL.title'),
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
              desc: t('tab.advanced.memoryEmbedding.apiKey.desc'),
              label: t('tab.advanced.memoryEmbedding.apiKey.title'),
            },
            {
              children: (
                <Input
                  placeholder={'text-embedding-3-small'}
                  style={INPUT_STYLE}
                  value={draft.model}
                  onChange={(event) => updateDraft({ model: event.target.value })}
                />
              ),
              desc: t('tab.advanced.memoryEmbedding.model.desc'),
              label: t('tab.advanced.memoryEmbedding.model.title'),
            },
          ]
        : []),
    ],
    extra: (
      <Button loading={saving} type={'primary'} onClick={handleSave}>
        {t('tab.advanced.memoryEmbedding.save')}
      </Button>
    ),
    title: t('tab.advanced.memoryEmbedding.title'),
  };
};
