import { createStaticStyles } from 'antd-style';

export const mobileStyles = createStaticStyles(({ css, cssVar }) => ({
  shell: css`
    --mobile-legacy-nav-padding: 0px;

    overflow: hidden;
    position: relative;
    width: 100%;
    min-width: 0;
    height: var(--mobile-viewport-height, 100dvh);
    padding-block-start: env(safe-area-inset-top, 0px);
    padding-inline: env(safe-area-inset-left, 0px) env(safe-area-inset-right, 0px);
    color: ${cssVar.colorText};
    background: ${cssVar.colorBgLayout};

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    input,
    textarea,
    [contenteditable='true'] {
      font-size: 16px;
    }

    :where(button, a, [tabindex]):focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: 2px;
    }
  `,
  viewport: css`
    overflow: hidden;
    flex: 1;
    min-width: 0;
    min-height: 0;
  `,
  navigation: css`
    z-index: 100;
    display: grid;
    flex: none;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    gap: 4px;
    width: 100%;
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom, 0px));
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};
  `,
  navButton: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 48px;
    height: auto;
    padding: 6px 2px;
    border-radius: 12px;
    font-size: 11px;
    line-height: 1.2;
    color: ${cssVar.colorTextSecondary};

    &[aria-current='page'] {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillSecondary};
      font-weight: 600;
    }
  `,
  header: css`
    z-index: 2;
    flex: none;
    gap: 8px;
    min-width: 0;
    min-height: 60px;
    padding: 8px 12px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};
  `,
  headerTitle: css`
    overflow: hidden;
    min-width: 0;
    margin: 0;
    font-size: 20px;
    line-height: 1.35;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  page: css`
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    height: 100%;
  `,
  scroll: css`
    overflow: auto;
    overscroll-behavior: contain;
    flex: 1;
    min-width: 0;
    min-height: 0;
    -webkit-overflow-scrolling: touch;
  `,
  content: css`
    width: 100%;
    max-width: 840px;
    margin-inline: auto;
    padding: 20px 16px calc(24px + env(safe-area-inset-bottom, 0px));

    @media (max-width: 359px) {
      padding-inline: 12px;
    }
  `,
  section: css`
    overflow: hidden;
    min-width: 0;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 16px;
    background: ${cssVar.colorBgContainer};
  `,
  sectionTitle: css`
    margin: 0;
    padding: 0 4px;
    font-size: 13px;
    font-weight: 500;
    color: ${cssVar.colorTextSecondary};
  `,
  row: css`
    justify-content: flex-start;
    min-width: 0;
    min-height: 60px;
    height: auto;
    padding: 14px 16px;
    border-radius: 0;
    color: ${cssVar.colorText};
    text-align: start;

    & + & {
      border-block-start: 1px solid ${cssVar.colorBorderSecondary};
    }
  `,
  rowIcon: css`
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    color: ${cssVar.colorTextSecondary};
    background: ${cssVar.colorFillTertiary};
  `,
  tabs: css`
    overflow-x: auto;
    flex: none;
    min-width: 0;
    padding: 8px 12px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};
    scrollbar-width: none;
  `,
  settings: css`
    min-width: 0;
    overflow-wrap: anywhere;

    [data-settings-section-header][data-has-extra='false'],
    [data-settings-title] {
      display: none;
    }

    .ant-form,
    .ant-form-item,
    .ant-form-item-control,
    .ant-form-item-control-input,
    .ant-form-item-control-input-content,
    .ant-collapse,
    .ant-collapse-content-box {
      min-width: 0;
      max-width: 100%;
    }

    .ant-form-item-label {
      overflow: visible;
      white-space: normal;
    }

    .ant-form-item-label > label {
      height: auto;
      white-space: normal;
    }

    .ant-table-wrapper {
      overflow-x: auto;
      max-width: 100%;
    }
  `,
  quickGrid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    min-width: 0;

    @media (min-width: 640px) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  `,
  quickAction: css`
    display: flex;
    flex-direction: column;
    gap: 14px;
    align-items: flex-start;
    justify-content: flex-start;
    min-width: 0;
    min-height: 132px;
    height: auto;
    padding: 18px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 16px;
    background: ${cssVar.colorBgContainer};
    white-space: normal;
    text-align: start;
  `,
}));
