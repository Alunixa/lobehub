import { Outlet } from 'react-router';

import MobileContentLayout from '@/components/server/MobileNavLayout';
import { MobileDiscoverHeader } from '@/features/MobileApp/DiscoverHeader';
import Footer from '@/features/Setting/Footer';

import { SCROLL_PARENT_ID } from '../../../../(main)/community/features/const';
import { styles } from './style';

const Layout = () => {
  return (
    <MobileContentLayout
      withNav
      className={styles.mainContainer}
      gap={16}
      header={<MobileDiscoverHeader />}
      id={SCROLL_PARENT_ID}
    >
      <Outlet />
      <div />
      <Footer />
    </MobileContentLayout>
  );
};

export default Layout;
