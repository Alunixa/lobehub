import { useTranslation } from 'react-i18next';

import { CurrentTimeSetting } from '@/features/Setting/CurrentTimeSetting';
import { GlobalBackgroundSetting } from '@/features/Setting/GlobalBackgroundSetting';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';

import ChatAppearance from '../chat-appearance/features/ChatAppearance';
import Appearance from '../common/features/Appearance';
import Common from '../common/features/Common/Common';
import Desktop from './features/Desktop';

const Page = () => {
  const { t } = useTranslation('setting');
  return (
    <>
      <SettingHeader title={t('tab.appearance')} />
      <Common />
      <CurrentTimeSetting />
      <Appearance />
      <GlobalBackgroundSetting />
      <Desktop />
      <ChatAppearance />
    </>
  );
};

export default Page;
