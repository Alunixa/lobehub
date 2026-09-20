'use client';

import { resolveTimeZone } from '@lobechat/utils/currentTime';
import { Flexbox, FormGroup } from '@lobehub/ui';
import { Alert, Switch, Text } from '@lobehub/ui/base-ui';
import { memo, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useUserStore } from '@/store/user';
import { userGeneralSettingsSelectors } from '@/store/user/selectors';

export const CurrentTimeSetting = memo(() => {
  const { t } = useTranslation('setting');
  const switchId = useId();
  const general = useUserStore(userGeneralSettingsSelectors.config);
  const [setSettings, ready] = useUserStore((s) => [s.setSettings, s.isUserStateInit]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const timezone = resolveTimeZone(
    general.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  return (
    <FormGroup
      collapsible={false}
      title={<label htmlFor={switchId}>{t('settingCommon.currentTime.title')}</label>}
      variant={'filled'}
      extra={
        <Switch
          checked={general.injectCurrentTime ?? false}
          disabled={!ready || saving}
          id={switchId}
          loading={saving}
          title={t('settingCommon.currentTime.title')}
          onChange={async (checked) => {
            setSaving(true);
            setFailed(false);
            try {
              await setSettings({ general: { injectCurrentTime: checked, timezone } });
            } catch (error) {
              console.error('Failed to save current time preference', error);
              setFailed(true);
            } finally {
              setSaving(false);
            }
          }}
        />
      }
    >
      <Flexbox gap={12} padding={16}>
        <Text type={'secondary'}>{t('settingCommon.currentTime.desc', { timezone })}</Text>
        {failed ? <Alert title={t('settingCommon.currentTime.saveFailed')} type={'error'} /> : null}
      </Flexbox>
    </FormGroup>
  );
});
