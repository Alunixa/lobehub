'use client';

import { resolveTimeZone } from '@lobechat/utils/currentTime';
import { Alert, FormGroup } from '@lobehub/ui';
import { Switch } from '@lobehub/ui/base-ui';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useUserStore } from '@/store/user';
import { userGeneralSettingsSelectors } from '@/store/user/selectors';

export const CurrentTimeSetting = memo(() => {
  const { t } = useTranslation('setting');
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
      desc={t('settingCommon.currentTime.desc', { timezone })}
      title={t('settingCommon.currentTime.title')}
      variant={'filled'}
      extra={
        <Switch
          aria-label={t('settingCommon.currentTime.title')}
          checked={general.injectCurrentTime ?? false}
          disabled={!ready || saving}
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
      {failed ? <Alert message={t('settingCommon.currentTime.saveFailed')} type={'error'} /> : null}
    </FormGroup>
  );
});
