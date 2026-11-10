'use client';

import type { BuiltinInspectorProps } from '@lobechat/types';
import { Text } from '@lobehub/ui';
import { cx } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { inspectorTextStyles, shinyTextStyles } from '@/styles';

import type { GenerateImageParams, GenerateImageState } from '../../types';
import { ImageGenerationApiName } from '../../types';

export const GenerateImageInspector = memo<
  BuiltinInspectorProps<GenerateImageParams, GenerateImageState>
>(({ args, partialArgs, isArgumentsStreaming, isLoading, pluginState, result }) => {
  const { t } = useTranslation('plugin');
  const pending = isArgumentsStreaming || isLoading;
  const hasImages = !!pluginState?.images?.length;
  const title = pending
    ? t('builtins.lobe-image-generation.inspector.loading')
    : result?.error
      ? t('builtins.lobe-image-generation.inspector.failed')
      : hasImages
        ? t('builtins.lobe-image-generation.inspector.completed')
        : t('builtins.lobe-image-generation.apiName.generateImage');

  return (
    <Text
      ellipsis
      as={'span'}
      className={cx(inspectorTextStyles.root, pending && shinyTextStyles.shinyText)}
      title={args?.prompt || partialArgs?.prompt}
    >
      {title}
      {hasImages && !pending ? ` · ${pluginState.images.length}` : ''}
    </Text>
  );
});

GenerateImageInspector.displayName = 'GenerateImageInspector';

export const ImageGenerationInspectors = {
  [ImageGenerationApiName.generateImage]: GenerateImageInspector,
};
