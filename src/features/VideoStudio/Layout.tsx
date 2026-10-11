'use client';

import { Flexbox } from '@lobehub/ui';
import { cx } from 'antd-style';
import { Outlet } from 'react-router';

import { studioStyles as styles } from '@/features/ImageStudio/styles';

export const VideoStudioLayout = ({ mobile = false }: { mobile?: boolean }) => (
  <Flexbox className={cx(styles.layout, mobile && styles.mobileLayout)}>
    <Outlet />
  </Flexbox>
);
