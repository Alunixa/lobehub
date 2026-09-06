import { useLayoutEffect, useRef } from 'react';

export const useMobileViewport = () => {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    const updateHeight = () => {
      if (viewport && viewport.scale !== 1) return;
      const height = viewport?.height ?? window.innerHeight;
      if (height > 0) ref.current?.style.setProperty('--mobile-viewport-height', `${height}px`);
    };
    updateHeight();
    viewport?.addEventListener('resize', updateHeight);
    window.addEventListener('resize', updateHeight);
    return () => {
      viewport?.removeEventListener('resize', updateHeight);
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  return ref;
};
