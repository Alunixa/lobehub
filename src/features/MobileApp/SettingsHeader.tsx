'use client';

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { SettingsTabs } from '@/store/global/initialState';

import { MobilePageHeader } from './Header';

const TITLE_KEYS: Partial<Record<SettingsTabs, string>> = {
  [SettingsTabs.Billing]: 'subscription:tab.billing',
  [SettingsTabs.Credits]: 'subscription:tab.credits',
  [SettingsTabs.Plans]: 'subscription:tab.plans',
  [SettingsTabs.Profile]: 'auth:profile.title',
  [SettingsTabs.Referral]: 'subscription:tab.referral',
  [SettingsTabs.ServiceModel]: 'setting:tab.serviceModel',
  [SettingsTabs.Stats]: 'auth:tab.stats',
  [SettingsTabs.SystemTools]: 'setting:tab.systemTools',
};

export const MobileSettingsHeader = () => {
  const { t } = useTranslation(['common', 'setting', 'auth', 'subscription']);
  const navigate = useWorkspaceAwareNavigate();
  const { providerId, tab, workspaceSlug } = useParams<{
    providerId?: string;
    tab?: string;
    workspaceSlug?: string;
  }>();
  const isProviderDetail = providerId && providerId !== 'all';
  const titleKey = tab ? TITLE_KEYS[tab as SettingsTabs] || `setting:tab.${tab}` : null;
  const title = isProviderDetail
    ? providerId
    : providerId
      ? t('tab.provider', { ns: 'setting' })
      : titleKey
        ? t(titleKey as never, { defaultValue: t('mobile.settings') })
        : workspaceSlug
          ? t('mobile.workspaceSettings')
          : t('mobile.settings');

  return (
    <MobilePageHeader
      title={title}
      onBack={() => {
        if (workspaceSlug) {
          navigate('/tools');
        } else if (isProviderDetail) {
          navigate('/settings/provider/all', { escape: true });
        } else if (tab || providerId) {
          navigate('/settings', { escape: true });
        } else {
          navigate('/me', { escape: true });
        }
      }}
    />
  );
};
