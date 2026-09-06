'use client';

import { Flexbox } from '@lobehub/ui';
import { cx } from 'antd-style';
import { Outlet } from 'react-router';

import RegisterHotkeys from '@/routes/(main)/(create)/image/_layout/RegisterHotkeys';

import { studioStyles as styles } from './styles';

export const ImageStudioLayout = ({ mobile = false }: { mobile?: boolean }) => {
  return (
    <Flexbox className={cx(styles.layout, mobile && styles.mobileLayout)}>
      <Outlet />
      <RegisterHotkeys />
    </Flexbox>
  );
};
