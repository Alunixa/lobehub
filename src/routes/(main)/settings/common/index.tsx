import { useTranslation } from 'react-i18next';

import { CurrentTimeSetting } from '@/features/Setting/CurrentTimeSetting';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';

import Appearance from './features/Appearance';
import Common from './features/Common/Common';

const Page = () => {
  const { t } = useTranslation('setting');
  return (
    <>
      <SettingHeader title={t('tab.common')} />
      <Common />
      <CurrentTimeSetting />
      <Appearance />
    </>
  );
};

export default Page;
