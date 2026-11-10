'use client';

import type { BuiltinPlaceholderProps } from '@lobechat/types';
import { Flexbox, Skeleton, Text } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { GenerateImageParams } from '../../types';
import { ImageGenerationApiName } from '../../types';

export const GenerateImagePlaceholder = memo<BuiltinPlaceholderProps<GenerateImageParams>>(() => {
  const { t } = useTranslation('plugin');

  return (
    <Flexbox gap={12} role={'status'} style={{ maxWidth: '100%', width: 512 }}>
      <Skeleton.Block active style={{ aspectRatio: '1', borderRadius: 8, width: '100%' }} />
      <Text fontSize={12} type={'secondary'}>
        {t('builtins.lobe-image-generation.placeholder')}
      </Text>
    </Flexbox>
  );
});

GenerateImagePlaceholder.displayName = 'GenerateImagePlaceholder';

export const ImageGenerationPlaceholders = {
  [ImageGenerationApiName.generateImage]: GenerateImagePlaceholder,
};
