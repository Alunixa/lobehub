import { createStaticStyles } from 'antd-style';

export const studioStyles = createStaticStyles(({ css, cssVar }) => ({
  layout: css`
    container-type: inline-size;
    overflow: hidden;
    flex: 1;

    min-width: 0;
    height: 100%;
    min-height: 0;

    background: ${cssVar.colorBgContainer};
  `,
  mobileLayout: css`
    height: 100%;
  `,
  page: css`
    overflow: hidden;
    flex: 1;
    min-width: 0;
    min-height: 0;
  `,
  header: css`
    flex: none;

    min-height: 60px;
    padding-block: 12px;
    padding-inline: 20px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  mobileHeader: css`
    flex: none;
    gap: 8px;

    padding-block: 8px;
    padding-inline: 12px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  body: css`
    container-type: inline-size;
    overflow: hidden;
    display: grid;
    grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
    flex: 1;
    gap: 20px;

    width: 100%;
    min-width: 0;
    min-height: 0;
    padding: 20px;

    background: ${cssVar.colorBgLayout};

    @container (max-width: 900px) {
      grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
      gap: 12px;
      padding: 16px;
    }

    &[data-mobile='true'] {
      grid-template-columns: minmax(0, 1fr);
      gap: 0;
      padding: 12px;
    }

    @media (orientation: landscape) and (height <= 500px) {
      &[data-mobile='true'] {
        padding: 8px;
      }
    }
  `,
  mobileBody: css`
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
    padding: 12px;
  `,
  viewTabs: css`
    flex: none;
    padding-inline: 12px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};
  `,
  composer: css`
    overflow: hidden;
    flex: 1;

    min-width: 0;
    min-height: 0;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    background: ${cssVar.colorBgContainer};

    &[data-mobile='true'] {
      border-radius: ${cssVar.borderRadiusLG};
    }
  `,
  scroll: css`
    scrollbar-gutter: stable;

    overflow: auto;
    overscroll-behavior: contain;
    flex: 1;

    min-width: 0;
    min-height: 0;

    -webkit-overflow-scrolling: touch;
  `,
  form: css`
    width: 100%;
    max-width: 640px;
    margin-inline: auto;
    padding: 24px;

    @media (width <= 420px) {
      padding-block: 16px;
      padding-inline: 12px;
    }
  `,
  fieldset: css`
    display: flex;
    flex-direction: column;
    gap: 24px;

    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;

    &:disabled {
      pointer-events: none;
      opacity: 0.65;
    }
  `,
  textarea: css`
    min-height: 148px;
    font-size: 16px;
    line-height: 1.6;
  `,
  footer: css`
    flex: none;
    gap: 8px;

    padding: 16px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};

    background: ${cssVar.colorBgContainer};

    @media (orientation: landscape) and (height <= 500px) {
      padding: 8px;
    }
  `,
  modelButton: css`
    justify-content: flex-start;
    width: 100%;
    min-width: 0;
    height: 44px;

    > span {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
  references: css`
    scrollbar-width: thin;

    overflow-x: auto;
    display: flex;
    gap: 12px;

    padding-block: 8px;
    padding-inline: 4px;

    .upload-card-close {
      opacity: 1 !important;
    }
  `,
  details: css`
    padding-block-start: 16px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};

    summary {
      cursor: pointer;
      min-height: 44px;
      font-weight: 500;
      line-height: 44px;
    }

    summary:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: 2px;
    }
  `,
  results: css`
    overflow: hidden;
    flex: 1;

    min-width: 0;
    min-height: 0;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    background: ${cssVar.colorBgContainer};
  `,
  resultsHeader: css`
    flex: none;

    min-width: 0;
    min-height: 72px;
    padding-block: 16px;
    padding-inline: 24px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  feed: css`
    width: 100%;
    max-width: 1440px;
    margin-inline: auto;
    padding: 20px;

    @media (width <= 600px) {
      padding: 12px;
    }
  `,
  empty: css`
    min-height: 240px;
    padding-block: 32px;
    padding-inline: 24px;
    text-align: center;
  `,
  emptyIcon: css`
    padding: 18px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 20px;

    color: ${cssVar.colorTextSecondary};

    background: ${cssVar.colorBgContainer};
  `,
  history: css`
    min-width: 0;
    height: 100%;
    min-height: 0;

    .nav-item-actions {
      width: auto !important;
      opacity: 1 !important;
    }
  `,
  historyRow: css`
    height: auto;
    min-height: 60px;
  `,
  status: css`
    padding-block: 16px;
    padding-inline: 16px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 12px;

    background: ${cssVar.colorBgContainer};
  `,
  parameterGrid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 12px;
  `,
  sectionLabel: css`
    padding-block-end: 8px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    font-size: 12px;
    font-weight: 500;
    color: ${cssVar.colorTextSecondary};
    letter-spacing: 0.5px;
  `,
}));
