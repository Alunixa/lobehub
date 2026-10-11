import { createStaticStyles } from 'antd-style';

export const mediaStudioStyles = createStaticStyles(({ css, cssVar }) => ({
  header: css`
    flex: none;

    min-height: 84px;
    padding-block: 16px;
    padding-inline: 24px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    background: ${cssVar.colorBgContainer};
  `,
  mobileHeader: css`
    flex: none;
    gap: 12px;

    padding-block: 16px 12px;
    padding-inline: 16px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    background: ${cssVar.colorBgContainer};

    @media (orientation: landscape) and (height <= 500px) {
      flex-direction: row;
      align-items: center;
      padding-block: 8px;

      > div:first-child {
        flex: 1;
        min-width: 0;
      }

      > div:last-child {
        flex: none;
        width: 204px;
      }
    }
  `,
  identity: css`
    min-width: 0;
  `,
  studioMark: css`
    display: grid;
    flex: none;
    place-items: center;

    width: 44px;
    height: 44px;
    border: 1px solid ${cssVar.colorPrimaryBorder};
    border-radius: ${cssVar.borderRadiusLG};

    color: ${cssVar.colorPrimary};

    background: ${cssVar.colorPrimaryBg};

    @media (orientation: landscape) and (height <= 500px) {
      width: 32px;
      height: 32px;
    }
  `,
  videoMark: css`
    border-radius: ${cssVar.borderRadius};
  `,
  title: css`
    font-size: ${cssVar.fontSizeHeading3};
    line-height: 1.25;
    letter-spacing: -0.6px;

    @media (width <= 600px) {
      font-size: ${cssVar.fontSizeHeading4};
    }

    @media (orientation: landscape) and (height <= 500px) {
      font-size: ${cssVar.fontSizeHeading4};
    }
  `,
  subtitle: css`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    @media (orientation: landscape) and (height <= 500px) {
      display: none;
    }
  `,
  modeTabs: css`
    min-width: 204px;
    padding: 4px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 12px;

    background: ${cssVar.colorFillQuaternary};

    @media (width <= 600px) {
      width: 100%;
    }
  `,
  empty: css`
    justify-content: center;

    height: 100%;
    min-height: 360px;
    padding-block: 48px;
    padding-inline: 24px;
  `,
  contactSheet: css`
    position: relative;
    transform: rotate(-2deg);

    display: grid;
    grid-template-columns: 1.2fr 1fr 0.8fr;
    gap: 8px;

    width: min(320px, 100%);
    padding-block: 16px 36px;
    padding-inline: 16px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    background: ${cssVar.colorBgContainer};
    box-shadow: 0 8px 28px ${cssVar.colorFillSecondary};
  `,
  filmSheet: css`
    transform: rotate(2deg);
    border-inline: 8px double ${cssVar.colorBorderSecondary};
  `,
  contactFrame: css`
    position: relative;

    overflow: hidden;
    display: grid;
    place-items: center;

    aspect-ratio: 3 / 4;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusSM};

    color: ${cssVar.colorTextQuaternary};

    background: ${cssVar.colorFillTertiary};
  `,
  frameHorizon: css`
    position: absolute;
    inset-block: 45% -20%;
    inset-inline: -25%;
    transform: rotate(-20deg);

    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 50% 45% 0 0;

    background: ${cssVar.colorFillSecondary};
  `,
  framePortrait: css`
    width: 45%;
    height: 55%;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 50% 50% 12px 12px;

    background: ${cssVar.colorBgContainer};
  `,
  sheetCaption: css`
    position: absolute;
    inset-block-end: 12px;
    inset-inline-start: 16px;

    font-family: ${cssVar.fontFamilyCode};
    font-size: ${cssVar.fontSizeSM};
    color: ${cssVar.colorTextDescription};
    letter-spacing: 2px;
  `,
  emptyTitle: css`
    font-size: ${cssVar.fontSizeHeading3};
    letter-spacing: -0.4px;
  `,
  emptyDescription: css`
    max-width: 340px;
    font-size: ${cssVar.fontSize};
    line-height: 1.75;
  `,
}));
