'use client';

import { createGlobalStyle, createStaticStyles, useTheme } from 'antd-style';
import isEqual from 'fast-deep-equal';
import { memo, useEffect, useMemo, useState } from 'react';

import { useIsMobile } from '@/hooks/useIsMobile';
import { useUserStore } from '@/store/user';
import { userGeneralSettingsSelectors } from '@/store/user/selectors';

import { normalizeBackgroundConfig } from './config';
import { useLoadedBackground } from './useLoadedBackground';

const BackgroundSurfaces = createGlobalStyle`
  html[data-global-background='on'] {
    .lobe-ui-theme-app {
      --ant-color-bg-layout: transparent;
      --ant-color-bg-container: color-mix(in srgb, var(--global-bg-solid) 18%, transparent);
      --ant-color-bg-container-secondary: color-mix(in srgb, var(--global-bg-solid) 12%, transparent);
      --lobe-color-bg-container-secondary: color-mix(in srgb, var(--global-bg-solid) 12%, transparent);

      isolation: isolate;
      background: transparent !important;
    }

    /* Keep original image previews opaque, including transparent uploaded PNGs. */
    .ant-image-preview-root .ant-image-preview-mask,
    .ant-image-preview-root .ant-image-mask,
    [role='dialog']:has(> img) {
      background: var(--global-bg-solid) !important;
      backdrop-filter: none !important;
    }
  }
`;

const styles = createStaticStyles(({ css }) => ({
  image: css`
    position: absolute;
    inset: 0;

    width: 100%;
    height: 100%;

    object-fit: cover;
  `,
  layer: css`
    pointer-events: none;

    position: fixed;
    z-index: -1;
    inset: 0;

    overflow: hidden;
  `,
  overlay: css`
    position: absolute;
    inset: 0;
  `,
}));

export const GlobalBackground = memo(() => {
  const mobile = useIsMobile();
  const theme = useTheme();
  const backgrounds = useUserStore(
    (s) => userGeneralSettingsSelectors.config(s).background,
    isEqual,
  );
  const config = useMemo(
    () => normalizeBackgroundConfig(backgrounds?.[mobile ? 'mobile' : 'desktop']),
    [backgrounds, mobile],
  );
  const [index, setIndex] = useState(0);
  const { loaded, markLoaded } = useLoadedBackground();
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const available = config.images.filter((image) => !failedUrls.includes(image.url));
  const image = available[index % Math.max(available.length, 1)];
  const active = config.enabled && !!image;

  useEffect(() => {
    setIndex(
      Math.max(
        0,
        config.images.findIndex((item) => item.id === config.activeImageId),
      ),
    );
    setFailedUrls([]);
  }, [config.activeImageId, config.images]);

  useEffect(() => {
    if (!active || !config.slideshow || available.length < 2) return;
    const timer = setInterval(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % available.length);
    }, config.intervalSeconds * 1000);
    return () => clearInterval(timer);
  }, [active, available.length, config.intervalSeconds, config.slideshow]);

  useEffect(() => {
    if (!active || !loaded) return;
    const root = document.documentElement;
    const previous = root.getAttribute('data-global-background');
    const previousColor = root.style.getPropertyValue('--global-bg-solid');
    root.style.setProperty('--global-bg-solid', theme.colorBgContainer);
    root.setAttribute('data-global-background', 'on');
    return () => {
      if (previous === null) root.removeAttribute('data-global-background');
      else root.setAttribute('data-global-background', previous);
      if (previousColor) root.style.setProperty('--global-bg-solid', previousColor);
      else root.style.removeProperty('--global-bg-solid');
    };
  }, [active, loaded, theme.colorBgContainer]);

  if (!active) return null;
  return (
    <>
      <BackgroundSurfaces />
      <div aria-hidden className={styles.layer} data-global-background-layer="">
        <img
          alt=""
          className={styles.image}
          key={image.url}
          src={image.url}
          style={{
            filter: config.blur ? `blur(${config.blur}px)` : undefined,
            opacity: config.opacity,
            transform: config.blur ? 'scale(1.08)' : undefined,
          }}
          onError={() => setFailedUrls((urls) => [...urls, image.url])}
          onLoad={() => markLoaded(image.url)}
        />
        <div
          className={styles.overlay}
          style={{
            background:
              config.overlayColor === 'auto' ? theme.colorBgContainer : config.overlayColor,
            opacity: config.overlayOpacity,
          }}
        />
      </div>
    </>
  );
});

GlobalBackground.displayName = 'GlobalBackground';
