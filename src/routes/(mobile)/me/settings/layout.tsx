import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate  } from 'react-router';

import MobileContentLayout from '@/components/server/MobileNavLayout';
import { MobilePageHeader } from '@/features/MobileApp/Header';

const Layout = memo(() => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  return (
    <MobileContentLayout
      header={<MobilePageHeader title={t('mobile.settings')} onBack={() => navigate('/me')} />}
    >
      <Outlet />
    </MobileContentLayout>
  );
});

export default Layout;
