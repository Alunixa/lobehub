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

  if (pluginError && !pluginState?.images?.length)
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
      {pluginState.incompleteReason && (
        <Alert
          description={t('builtins.lobe-image-generation.render.retryHint')}
          type={'warning'}
          title={t('builtins.lobe-image-generation.render.partial', {
            completed: pluginState.images.length,
            requested: pluginState.requestedCount ?? args?.imageNum ?? 1,
          })}
        />
      )}
      {pluginState.images.map((image) => (
        <Flexbox gap={4} key={image.fileId}>
          <GeneratedImagePreview image={image} />
          <Text fontSize={12} type={'secondary'}>
            {t('builtins.lobe-image-generation.render.actualDimensions', {
              height: image.height,
              width: image.width,
            })}
          </Text>
          <Text fontSize={12} type={'secondary'} wordBreak={'break-word'}>
            {t('builtins.lobe-image-generation.render.outputFileId')}: {image.fileId}
          </Text>
        </Flexbox>
      ))}
      <Flexbox gap={4}>
        <Text strong>{t('builtins.lobe-image-generation.render.callDetails')}</Text>
        <Text fontSize={12} wordBreak={'break-word'}>
          {pluginState.provider} / {pluginState.model}
          {pluginState.requestReceipt?.resolvedModel &&
          pluginState.requestReceipt.resolvedModel !== pluginState.model
            ? ` → ${pluginState.requestReceipt.resolvedModel}`
            : ''}
        </Text>
        <Text fontSize={12}>
          {t('builtins.lobe-image-generation.render.imageCount', {
            completed: pluginState.images.length,
            requested: pluginState.requestedCount ?? args?.imageNum ?? 1,
          })}
        </Text>
        <Text fontSize={12} wordBreak={'break-word'}>
          {t(
            pluginState.requestReceipt
              ? 'builtins.lobe-image-generation.render.referencesUsed'
              : 'builtins.lobe-image-generation.render.referencesRequested',
          )}
          {': '}
          {(pluginState.requestReceipt?.referenceImageFileIds ?? args?.referenceImageFileIds)?.join(
            ' → ',
          ) || t('builtins.lobe-image-generation.render.none')}
          {pluginState.requestReceipt?.referenceInput
            ? ` (${pluginState.requestReceipt.referenceInput})`
            : ''}
        </Text>
        <Text fontSize={12} wordBreak={'break-word'}>
          {t('builtins.lobe-image-generation.render.requestedOptions')}:{' '}
          {JSON.stringify(args?.options ?? {})}
        </Text>
        <Text fontSize={12} wordBreak={'break-word'}>
          {t('builtins.lobe-image-generation.render.runtimeOptions')}:{' '}
          {pluginState.requestReceipt
            ? JSON.stringify(pluginState.requestReceipt.runtimeOptions)
            : t('builtins.lobe-image-generation.render.runtimeUnknown')}
        </Text>
      </Flexbox>
      <Flexbox gap={4}>
        <Text strong fontSize={12}>
          {t('builtins.lobe-image-generation.render.prompt')}
        </Text>
        <Text
          ellipsis={expanded ? false : { rows: 3 }}
          fontSize={12}
          type={'secondary'}
          wordBreak={'break-word'}
        >
          {args?.prompt}
        </Text>
        {args?.prompt && (args.prompt.length > 180 || args.prompt.includes('\n')) && (
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
    </Flexbox>
  );
});

GenerateImageRender.displayName = 'GenerateImageRender';

export const ImageGenerationRenders = {
  [ImageGenerationApiName.generateImage]: GenerateImageRender,
};
