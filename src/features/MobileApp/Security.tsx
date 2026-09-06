'use client';

import { Flexbox, FormGroup } from '@lobehub/ui';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import EmailRow from '@/routes/(main)/settings/profile/features/EmailRow';
import PasswordRow from '@/routes/(main)/settings/profile/features/PasswordRow';
import SSOProvidersList from '@/routes/(main)/settings/profile/features/SSOProvidersList';
import { serverConfigSelectors, useServerConfigStore } from '@/store/serverConfig';
import { useUserStore } from '@/store/user';
import { authSelectors, userProfileSelectors } from '@/store/user/selectors';

import { mobileStyles as styles } from './styles';

export const MobileSecuritySettings = () => {
  const { t } = useTranslation('auth');
  const fetchAuthProviders = useUserStore((s) => s.fetchAuthProviders);
  const isLogin = useUserStore(authSelectors.isLogin);
  const email = useUserStore(userProfileSelectors.userProfile)?.email;
  const disablePassword = useServerConfigStore(serverConfigSelectors.disableEmailPassword);

  useEffect(() => {
    if (isLogin) void fetchAuthProviders();
  }, [fetchAuthProviders, isLogin]);

  return (
    <Flexbox className={styles.content} data-testid={'mobile-security'} gap={20}>
      <FormGroup collapsible={false} title={t('profile.account')} variant={'filled'}>
        {email && <EmailRow />}
        {!disablePassword && <PasswordRow />}
        <SSOProvidersList />
      </FormGroup>
    </Flexbox>
  );
};
