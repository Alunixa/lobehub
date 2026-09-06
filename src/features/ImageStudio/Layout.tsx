'use client';

import { Flexbox } from '@lobehub/ui';
import { cx } from 'antd-style';
import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router';

import RegisterHotkeys from '@/routes/(main)/(create)/image/_layout/RegisterHotkeys';

import { studioStyles as styles } from './styles';

export const ImageStudioLayout = ({ mobile = false }: { mobile?: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!mobile || !viewport) return;

    const updateHeight = () => {
      // Respect pinch zoom; only keyboard/browser-chrome resizing changes the layout.
      if (viewport.scale === 1) {
        ref.current?.style.setProperty('--studio-viewport-height', `${viewport.height}px`);
      }
    };
    updateHeight();
    viewport.addEventListener('resize', updateHeight);
    return () => viewport.removeEventListener('resize', updateHeight);
  }, [mobile]);

  return (
    <Flexbox className={cx(styles.layout, mobile && styles.mobileLayout)} ref={ref}>
      <Outlet />
      <RegisterHotkeys />
    </Flexbox>
  );
};
