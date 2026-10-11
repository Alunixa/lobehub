'use client';

import { Center, Flexbox } from '@lobehub/ui';
import { ActionIcon, Alert, Button, Text } from '@lobehub/ui/base-ui';
import { RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { studioStyles as styles } from '@/features/ImageStudio/styles';
import { MediaStudioEmpty } from '@/features/MediaStudio';
import { VideoGenerationBatchItem } from '@/routes/(main)/(create)/video/features/GenerationFeed/BatchItem';
import { useVideoStore } from '@/store/video';

import type { useVideoStudio } from './useVideoStudio';

export const VideoStudioResults = ({ studio }: { studio: ReturnType<typeof useVideoStudio> }) => {
  const { t } = useTranslation(['image', 'video', 'common']);
  const scrollRef = useRef<HTMLDivElement>(null);
  const title = useVideoStore(
    (s) => s.generationTopics.find((topic) => topic.id === studio.activeTopicId)?.title,
  );
  const batches = useMemo(
    () => [...studio.batches].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [studio.batches],
  );
  const newest = batches[0]?.id;
  useEffect(() => scrollRef.current?.scrollTo({ top: 0 }), [newest, studio.activeTopicId]);
  return (
    <Flexbox className={styles.results} data-testid={'video-studio-results'}>
      <Flexbox
        horizontal
        align={'center'}
        className={styles.resultsHeader}
        gap={8}
        justify={'space-between'}
      >
        <Flexbox gap={3} style={{ minWidth: 0 }}>
          <Text ellipsis weight={600}>
            {title || t('studio.results')}
          </Text>
          <Text aria-live={'polite'} fontSize={12} type={'secondary'}>
            {studio.counts.total
              ? t('studio.taskSummary', studio.counts)
              : t('mediaStudio.videoResultsDescription', { ns: 'common' })}
          </Text>
        </Flexbox>
        <ActionIcon
          aria-label={t('studio.refresh')}
          disabled={!studio.activeTopicId || studio.batchesQuery.isValidating}
          icon={RefreshCw}
          loading={studio.batchesQuery.isValidating}
          size={{ blockSize: 44, size: 18 }}
          onClick={() => void studio.batchesQuery.mutate()}
        />
      </Flexbox>
      <Flexbox className={styles.scroll} ref={scrollRef}>
        <Flexbox className={styles.feed} gap={20}>
          {!!studio.submitError && (
            <Alert
              showIcon
              description={t('studio.submitErrorDescription')}
              title={t('studio.submitError')}
              type={'error'}
              action={
                <Button size={'small'} onClick={() => studio.setView('create')}>
                  {t('studio.backToCreate')}
                </Button>
              }
            />
          )}
          {studio.batchesQuery.error && (
            <AsyncError
              error={studio.batchesQuery.error}
              variant={'block'}
              onRetry={() => studio.batchesQuery.mutate()}
            />
          )}
          {studio.isCreating && (
            <Flexbox
              horizontal
              align={'center'}
              aria-live={'polite'}
              className={styles.status}
              gap={12}
              role={'status'}
            >
              <NeuralNetworkLoading size={28} />
              <Flexbox gap={4}>
                <Text weight={500}>{t('studio.submitting')}</Text>
                <Text fontSize={12} type={'secondary'}>
                  {t('studio.submittingDescription')}
                </Text>
              </Flexbox>
            </Flexbox>
          )}
          {!batches.length && studio.batchesQuery.isLoading && !studio.isCreating && (
            <Center gap={12} padding={32} role={'status'}>
              <NeuralNetworkLoading size={40} />
              <Text type={'secondary'}>{t('studio.loadingResults')}</Text>
            </Center>
          )}
          {!batches.length &&
            !studio.isCreating &&
            !studio.batchesQuery.isLoading &&
            !studio.batchesQuery.error &&
            !studio.submitError && (
              <MediaStudioEmpty mode={'video'} onCreate={() => studio.setView('create')} />
            )}
          {batches.map((batch) => (
            <VideoGenerationBatchItem batch={batch} key={batch.id} />
          ))}
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
};
