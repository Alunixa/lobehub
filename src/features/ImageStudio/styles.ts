import { createStaticStyles } from 'antd-style';

export const studioStyles = createStaticStyles(({ css, cssVar }) => ({
  layout: css`
    overflow: hidden;
    flex: 1;
    min-width: 0;
    min-height: 0;
    height: 100%;
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
    padding: 12px 20px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  mobileHeader: css`
    flex: none;
    gap: 8px;
    padding: 8px 12px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  body: css`
    container-type: inline-size;
    overflow: hidden;
    display: grid;
    flex: 1;
    grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
    width: 100%;
  `,
  mobileBody: css`
    grid-template-columns: minmax(0, 1fr);
  `,
  composer: css`
    overflow: hidden;
    flex: 1;
    min-width: 0;
    min-height: 0;
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};

    &[data-mobile='true'] {
      border: 0;
    }
  `,
  scroll: css`
    overflow: auto;
    overscroll-behavior: contain;
    flex: 1;
    min-width: 0;
    min-height: 0;
    scrollbar-gutter: stable;
    -webkit-overflow-scrolling: touch;
  `,
  form: css`
    width: 100%;
    max-width: 640px;
    margin-inline: auto;
    padding: 20px;

    @media (max-width: 420px) {
      padding: 16px 12px;
    }
  `,
  fieldset: css`
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;

    &:disabled {
      opacity: 0.65;
      pointer-events: none;
    }
  `,
  textarea: css`
    min-height: 128px;
    font-size: 16px;
    line-height: 1.6;
  `,
  footer: css`
    flex: none;
    gap: 8px;
    padding: 12px 16px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};
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
    overflow-x: auto;
    display: flex;
    gap: 12px;
    padding: 8px 4px;
    scrollbar-width: thin;

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
    background: ${cssVar.colorBgLayout};
  `,
  resultsHeader: css`
    flex: none;
    min-width: 0;
    padding: 12px 20px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  feed: css`
    width: 100%;
    max-width: 1440px;
    margin-inline: auto;
    padding: 20px;

    @media (max-width: 600px) {
      padding: 12px;
    }
  `,
  empty: css`
    min-height: 240px;
    padding: 32px 24px;
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
    min-height: 0;
    height: 100%;

    .nav-item-actions {
      width: auto !important;
      opacity: 1 !important;
    }
  `,
  historyRow: css`
    min-height: 60px;
    height: auto;
  `,
  status: css`
    padding: 14px 16px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 12px;
    background: ${cssVar.colorBgContainer};
  `,
}));
