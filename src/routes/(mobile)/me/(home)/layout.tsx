import { memo } from 'react';
import { Outlet } from 'react-router';

const Layout = memo(() => {
  return <Outlet />;
});

export default Layout;
