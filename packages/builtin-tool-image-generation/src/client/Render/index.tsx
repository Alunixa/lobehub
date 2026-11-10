'use client';

import type { BuiltinRenderProps } from '@lobechat/types';
import { Alert, Flexbox, Image, Text } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  GeneratedConversationImage,
  GenerateImageParams,
  GenerateImageState,
} from '../../types';
import { ImageGenerationApiName } from '../../types';

const styles = createStaticStyles(({ css, cssVar }) => ({
  image: css`
    overflow: hidden;
    border-radius: ${cssVar.borderRadiusLG};
  `,
}));

const GeneratedImagePreview = memo<{ image: GeneratedConversationImage }>(({ image }) => {
  const { t } = useTranslation('plugin');
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  if (failed)
    return (
      <Alert
        title={t('builtins.lobe-image-generation.render.previewFailed')}
        type={'error'}
        extra={
          <Button
            size={'small'}
            onClick={() => {
              setAttempt((value) => value + 1);
              setFailed(false);
            }}
          >
            {t('builtins.lobe-image-generation.render.reloadImage')}
          </Button>
        }
      />
    );

  return (
    <Image
      alt={t('builtins.lobe-image-generation.render.imageAlt')}
      className={styles.image}
      key={attempt}
      maxHeight={640}
      maxWidth={'100%'}
      objectFit={'contain'}
      src={image.url}
      styles={{ wrapper: { maxWidth: '100%' } }}
      onError={() => setFailed(true)}
    />
  );
});

GeneratedImagePreview.displayName = 'GeneratedImagePreview';

export const GenerateImageRender = memo<
  BuiltinRenderProps<GenerateImageParams, GenerateImageState>
>(({ args, pluginError, pluginState, content }) => {
  const { t } = useTranslation('plugin');
  const [expanded, setExpanded] = useState(false);

  if (pluginError)
    return (
      <Alert
        title={t('builtins.lobe-image-generation.render.failed')}
        type={'error'}
        description={
          <Flexbox gap={8}>
            <Text>{pluginError.message || content}</Text>
            <Text type={'secondary'}>{t('builtins.lobe-image-generation.render.retryHint')}</Text>
          </Flexbox>
        }
      />
    );

  if (!pluginState) return null;
  if (!pluginState.images?.length)
    return <Alert title={t('builtins.lobe-image-generation.render.empty')} type={'warning'} />;

  return (
    <Flexbox gap={12} style={{ maxWidth: '100%', width: 512 }}>
      {pluginState.images.map((image) => (
        <GeneratedImagePreview image={image} key={image.fileId} />
      ))}
      <Flexbox gap={4}>
        <Text
          ellipsis={expanded ? false : { rows: 3 }}
          fontSize={12}
          type={'secondary'}
          wordBreak={'break-word'}
        >
          {args?.prompt}
        </Text>
        {args?.prompt && args.prompt.length > 180 && (
          <Button
            aria-expanded={expanded}
            size={'small'}
            style={{ alignSelf: 'flex-start' }}
            type={'text'}
            onClick={() => setExpanded((value) => !value)}
          >
            {t(
              expanded
                ? 'builtins.lobe-image-generation.render.hidePrompt'
                : 'builtins.lobe-image-generation.render.showPrompt',
            )}
          </Button>
        )}
      </Flexbox>
      <Text fontSize={12} type={'secondary'}>
        {pluginState.provider} / {pluginState.model}
      </Text>
    </Flexbox>
  );
});

GenerateImageRender.displayName = 'GenerateImageRender';

export const ImageGenerationRenders = {
  [ImageGenerationApiName.generateImage]: GenerateImageRender,
};
