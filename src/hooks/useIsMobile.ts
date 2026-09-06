import { useResponsive } from 'antd-style';
import { useMemo } from 'react';

export const useIsMobile = (): boolean => {
  const { mobile } = useResponsive();

  // A phone's landscape viewport can exceed the responsive breakpoint, but the
  // dedicated mobile bundle must not suddenly mount desktop-only sidebars.
  return useMemo(() => (typeof __MOBILE__ !== 'undefined' && __MOBILE__) || !!mobile, [mobile]);
};
