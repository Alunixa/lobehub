'use client';

import { useAutoAnimate } from '@formkit/auto-animate/react';
import { ModelTag } from '@lobehub/icons';
import { ActionIconGroup, Block, Flexbox, Image, Markdown } from '@lobehub/ui';
import { Button, confirmModal, Tag, Text } from '@lobehub/ui/base-ui';
import { App } from 'antd';
import { createStaticStyles } from 'antd-style';
import dayjs from 'dayjs';
import { omit } from 'es-toolkit/compat';
import { CopyIcon, RefreshCw, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { RuntimeImageGenParams } from 'model-bank';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useActiveWorkspaceId } from '@/business/client/hooks/useActiveWorkspaceId';
import useRenderBusinessBatchItem from '@/business/client/hooks/useRenderBusinessBatchItem';
import {
  type ImageRetryModelSelection,
  openImageRetryModelModal,
} from '@/features/ImageStudio/RetryModelModal';
import { GenerationInvalidAPIKey } from '@/routes/(main)/(create)/features/GenerationInput';
import { aiProviderSelectors, useAiInfraStore } from '@/store/aiInfra';
import { useImageStore } from '@/store/image';
import { getReusableImageConfig } from '@/store/image/slices/generationConfig/action';
import { AsyncTaskErrorType } from '@/types/asyncTask';
import { type GenerationBatch } from '@/types/generation';

import { GenerationItem } from './GenerationItem';
import { ReferenceImages } from './ReferenceImages';

const styles = createStaticStyles(({ css, cssVar }) => ({
  batchActions: css`
    flex-wrap: wrap;
    gap: 8px;
  `,
  batchDeleteButton: css`
    &:hover {
      border-color: ${cssVar.colorError} !important;
      color: ${cssVar.colorError} !important;
      background: ${cssVar.colorErrorBg} !important;
    }
  `,
  container: css`
    min-width: 0;
    padding: 16px;
    background: ${cssVar.colorBgContainer};
  `,
  grid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
    gap: 12px;
    align-items: start;
    min-width: 0;
  `,

  prompt: css`
    overflow: auto;
    max-height: 160px;
    overflow-wrap: anywhere;

    pre {
      overflow: hidden !important;
      padding-block: 4px;
      font-size: 13px;
    }
  `,
}));

interface GenerationBatchItemProps {
  batch: GenerationBatch;
  onReuse?: () => void;
}

export const GenerationBatchItem = memo<GenerationBatchItemProps>(({ batch, onReuse }) => {
  const { t } = useTranslation('image');
  const { message } = App.useApp();

  const [imageGridRef] = useAutoAnimate();

  const activeTopicId = useImageStore((s) => s.activeGenerationTopicId);
  const recreateImage = useImageStore((s) => s.recreateImage);
  const removeGenerationBatch = useImageStore((s) => s.removeGenerationBatch);
  const reuseSettings = useImageStore((s) => s.reuseSettings);
  const isCreating = useImageStore((s) => s.isCreating);
  const enabledModels = useAiInfraStore(aiProviderSelectors.enabledImageModelList);
  const activeWorkspaceId = useActiveWorkspaceId();
  const { shouldRenderBusinessBatchItem, businessBatchItem } = useRenderBusinessBatchItem(batch);

  const creator = batch.creator;
  const showCreator = Boolean(activeWorkspaceId && creator?.id);
  const creatorName = creator?.fullName || creator?.username || '';

  const time = useMemo(() => {
    return dayjs(batch.createdAt).format('YYYY-MM-DD HH:mm:ss');
  }, [batch.createdAt]);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(batch.prompt);
      message.success(t('generation.actions.promptCopied'));
    } catch (error) {
      console.error('Failed to copy prompt:', error);
      message.error(t('generation.actions.promptCopyFailed'));
    }
  };

  const batchModelAvailable = enabledModels.some(
    (provider) =>
      provider.id === batch.provider && provider.children.some((model) => model.id === batch.model),
  );

  const applySettings = async (selection: ImageRetryModelSelection) => {
    try {
      reuseSettings(
        selection.model,
        selection.provider,
        omit(batch.config as RuntimeImageGenParams, ['seed']),
      );
      onReuse?.();
      message.success(t('studio.settingsLoaded'));
    } catch (error) {
      console.error('Failed to reuse image generation settings:', error);
      message.error(t('studio.settingsLoadFailed'));
      throw error;
    }
  };

  const runRegenerate = async (selection?: ImageRetryModelSelection) => {
    try {
      const options = selection
        ? {
            model: selection.model,
            params: getReusableImageConfig(
              selection.model,
              selection.provider,
              omit(batch.config as RuntimeImageGenParams, ['seed']),
            ).parameters,
            provider: selection.provider,
          }
        : undefined;

      await recreateImage(batch.id, options);
      message.success(t('studio.regenerateSubmitted'));
    } catch (error) {
      console.error('Failed to regenerate image batch:', error);
      message.error(t('studio.regenerateFailed'));
      throw error;
    }
  };

  const handleReuseSettings = () => {
    if (isCreating) return;

    if (batchModelAvailable) {
      void applySettings({ model: batch.model, provider: batch.provider }).catch(() => undefined);
      return;
    }

    openImageRetryModelModal({
      mode: 'adjust',
      originalModel: batch.model,
      originalProvider: batch.provider,
      onConfirm: applySettings,
    });
  };

  const handleRegenerate = () => {
    if (isCreating) return;

    if (batchModelAvailable) {
      void runRegenerate().catch(() => undefined);
      return;
    }

    openImageRetryModelModal({
      mode: 'regenerate',
      originalModel: batch.model,
      originalProvider: batch.provider,
      onConfirm: runRegenerate,
    });
  };

  const handleDeleteBatch = async () => {
    if (!activeTopicId) return;

    try {
      await removeGenerationBatch(batch.id, activeTopicId);
    } catch (error) {
      console.error('Failed to delete batch:', error);
      message.error(t('studio.deleteFailed'));
    }
  };

  if (batch.generations.length === 0) {
    return null;
  }

  const isInvalidApiKey = batch.generations.some(
    (generation) => generation.task.error?.name === AsyncTaskErrorType.InvalidProviderAPIKey,
  );

  if (isInvalidApiKey) {
    return (
      <GenerationInvalidAPIKey
        provider={batch.provider}
        onNavigate={() => {
          if (!activeTopicId) return;
          removeGenerationBatch(batch.id, activeTopicId);
        }}
      />
    );
  }

  if (shouldRenderBusinessBatchItem) {
    return businessBatchItem;
  }

  return (
    <Block className={styles.container} gap={12} variant="outlined">
      <div className={styles.prompt}>
        <Markdown variant={'chat'}>{batch.prompt}</Markdown>
      </div>
      <Flexbox align={'flex-start'} gap={8}>
        <ReferenceImages imageUrl={batch.config?.imageUrl} imageUrls={batch.config?.imageUrls} />
      </Flexbox>
      <Image.PreviewGroup>
        <div className={styles.grid} ref={imageGridRef}>
          {batch.generations.map((generation) => (
            <GenerationItem
              generation={generation}
              generationBatch={batch}
              key={generation.id}
              prompt={batch.prompt}
            />
          ))}
        </div>
      </Image.PreviewGroup>
      <Flexbox
        horizontal
        align={'center'}
        gap={4}
        justify={'space-between'}
        style={{ opacity: 0.66 }}
        wrap={'wrap'}
      >
        <Flexbox horizontal align={'center'} gap={4} wrap={'wrap'}>
          <ModelTag model={batch.model} variant={'borderless'} />
          {batch.width && batch.height && (
            <Tag variant={'borderless'}>
              {batch.width} × {batch.height}
            </Tag>
          )}
          <Tag variant={'borderless'}>
            {t('generation.metadata.count', { count: batch.generations.length })}
          </Tag>
        </Flexbox>
        <Flexbox horizontal align={'center'} gap={6} wrap={'wrap'}>
          {showCreator && (
            <>
              <Text fontSize={12} type={'secondary'}>
                {t('generation.metadata.by', { name: creatorName })}
              </Text>
              <Text fontSize={12} type={'secondary'}>
                ·
              </Text>
            </>
          )}
          <Text as={'time'} fontSize={12} type={'secondary'}>
            {t('generation.metadata.createdAt', { time })}
          </Text>
        </Flexbox>
      </Flexbox>
      <Flexbox horizontal align={'center'} className={styles.batchActions}>
        <Button
          disabled={isCreating}
          icon={<RefreshCw size={18} />}
          loading={isCreating}
          size={'small'}
          style={{ minHeight: 44 }}
          onClick={handleRegenerate}
        >
          {t('studio.regenerate')}
        </Button>
        <Button
          disabled={isCreating}
          icon={<SlidersHorizontal size={18} />}
          size={'small'}
          style={{ minHeight: 44 }}
          onClick={handleReuseSettings}
        >
          {t('studio.adjustAndRetry')}
        </Button>
        <ActionIconGroup
          size={{ blockSize: 44, size: 18 }}
          items={[
            {
              icon: CopyIcon,
              key: 'copyPrompt',
              label: t('generation.actions.copyPrompt'),
              onClick: handleCopyPrompt,
            },
            {
              danger: true,
              icon: Trash2,
              key: 'deleteBatch',
              label: t('generation.actions.deleteBatch'),
              onClick: () => {
                confirmModal({
                  cancelText: t('cancel', { ns: 'common' }),
                  content: t('studio.deleteBatchDescription'),
                  okButtonProps: { danger: true },
                  okText: t('delete', { ns: 'common' }),
                  onOk: handleDeleteBatch,
                  title: t('generation.actions.deleteBatch'),
                });
              },
            },
          ]}
        />
      </Flexbox>
    </Block>
  );
});

GenerationBatchItem.displayName = 'GenerationBatchItem';
