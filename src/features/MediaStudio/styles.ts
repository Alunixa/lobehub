import { createStaticStyles } from 'antd-style';

export const mediaStudioStyles = createStaticStyles(({ css, cssVar }) => ({
  header: css`
    flex: none;

    min-height: 84px;
    padding-block: 18px;
    padding-inline: 24px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    background: ${cssVar.colorBgContainer};
  `,
  mobileHeader: css`
    flex: none;

    padding-block: 16px 10px;
    padding-inline: 16px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    background: ${cssVar.colorBgContainer};
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
    border-radius: 14px;

    color: ${cssVar.colorPrimary};

    background: ${cssVar.colorPrimaryBg};
  `,
  videoMark: css`
    border-radius: 10px;
  `,
  title: css`
    font-size: 23px;
    line-height: 1.25;
    letter-spacing: -0.6px;

    @media (width <= 600px) {
      font-size: 20px;
    }
  `,
  subtitle: css`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  modeTabs: css`
    min-width: 204px;
    padding: 3px;
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
    padding-block: 14px 34px;
    padding-inline: 14px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 16px;

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
    border-radius: 7px;

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
    font-size: 9px;
    color: ${cssVar.colorTextDescription};
    letter-spacing: 2px;
  `,
  emptyTitle: css`
    font-size: 23px;
    letter-spacing: -0.4px;
  `,
  emptyDescription: css`
    max-width: 340px;
    font-size: 13px;
    line-height: 1.75;
  `,
}));
