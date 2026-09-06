'use client';

import { Flexbox } from '@lobehub/ui';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate } from 'react-router';

import { MobilePageHeader } from './Header';
import { mobileStyles as styles } from './styles';

export const MobileProfileLayout = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <Flexbox className={styles.page}>
      <MobilePageHeader title={t('userPanel.profile')} onBack={() => navigate('/me')} />
      <Flexbox className={styles.scroll}>
        <Flexbox className={styles.content}>
          <Outlet />
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
};
