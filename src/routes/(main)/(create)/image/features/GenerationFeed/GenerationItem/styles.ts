import { createStaticStyles, cx, keyframes } from 'antd-style';

const shimmer = keyframes`
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
`;

export const styles = createStaticStyles(({ css, cssVar }) => ({
  // Common styles for image action buttons
  generationActionButton: cx(
    'generation-actions',
    css`
      position: absolute;
      z-index: 10;
      inset-block-end: 8px;
      inset-inline-end: 8px;

      opacity: 1;
      background: ${cssVar.colorBgElevated};
      border-radius: 8px;
    `,
  ),

  imageContainer: css`
    position: relative;
    overflow: hidden;
    width: 100%;
    min-width: 0;
    min-height: 140px;
    max-height: min(560px, 65dvh);

    img {
      object-fit: contain !important;
    }

    &:hover .generation-actions {
      opacity: 1;
    }
  `,

  placeholderContainer: css`
    position: relative;
    overflow: hidden;
    width: 100%;
    min-width: 0;
    min-height: 180px;
    max-height: min(440px, 65dvh);

    &:hover .generation-actions {
      opacity: 1;
    }
  `,

  placeholderContainerLoading: css`
    &::before {
      content: '';

      position: absolute;
      z-index: 1;
      inset: 0;

      background: ${cssVar.colorFillSecondary};

      animation: ${shimmer} 2s linear infinite;

      @media (prefers-reduced-motion: reduce) {
        animation: none;
      }
    }
  `,

  spinIcon: css`
    color: ${cssVar.colorPrimary};
  `,
}));
