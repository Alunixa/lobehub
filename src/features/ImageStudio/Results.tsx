'use client';

import { ActionIcon, Alert, Center, Flexbox, Text } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { Images, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { GenerationBatchItem } from '@/routes/(main)/(create)/image/features/GenerationFeed/BatchItem';
import { useImageStore } from '@/store/image';

import { studioStyles as styles } from './styles';
import type { useImageStudio } from './useImageStudio';

interface StudioResultsProps {
  onCreate: () => void;
  studio: ReturnType<typeof useImageStudio>;
}

export const StudioResults = ({ onCreate, studio }: StudioResultsProps) => {
  const { t } = useTranslation('image');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { activeTopicId, batches, batchesQuery, counts, isCreating, submitError } = studio;
  const title = useImageStore(
    (s) => s.generationTopics.find((topic) => topic.id === activeTopicId)?.title,
  );
  const orderedBatches = useMemo(
    () => [...batches].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [batches],
  );
  const newestId = orderedBatches[0]?.id;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [activeTopicId, newestId]);

  return (
    <Flexbox className={styles.results} data-testid={'studio-results'}>
      <Flexbox
        horizontal
        align={'center'}
        className={styles.resultsHeader}
        gap={8}
        justify={'space-between'}
      >
        <Flexbox gap={2} style={{ minWidth: 0 }}>
          <Text ellipsis weight={600}>
            {title || t('studio.results')}
          </Text>
          <Text aria-live={'polite'} fontSize={12} type={'secondary'}>
            {counts.total ? t('studio.taskSummary', counts) : t('studio.resultsDescription')}
          </Text>
        </Flexbox>
        <ActionIcon
          aria-label={t('studio.refresh')}
          disabled={!activeTopicId || batchesQuery.isValidating}
          icon={RefreshCw}
          loading={batchesQuery.isValidating}
          size={{ blockSize: 44, size: 18 }}
          onClick={() => void batchesQuery.mutate()}
        />
      </Flexbox>
      <Flexbox className={styles.scroll} ref={scrollRef}>
        <Flexbox className={styles.feed} gap={20}>
          {!!submitError && (
            <Alert
              showIcon
              description={t('studio.submitErrorDescription')}
              title={t('studio.submitError')}
              type={'error'}
              action={
                <Button size={'small'} onClick={onCreate}>
                  {t('studio.backToCreate')}
                </Button>
              }
            />
          )}
          {batchesQuery.error && (
            <AsyncError
              error={batchesQuery.error}
              variant={'block'}
              onRetry={() => batchesQuery.mutate()}
            />
          )}
          {isCreating && (
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
          {!batches.length && batchesQuery.isLoading && !isCreating && (
            <Center gap={12} padding={32} role={'status'}>
              <NeuralNetworkLoading size={40} />
              <Text type={'secondary'}>{t('studio.loadingResults')}</Text>
            </Center>
          )}
          {!batches.length &&
            !isCreating &&
            !batchesQuery.isLoading &&
            !batchesQuery.error &&
            !submitError && (
              <Center className={styles.empty} gap={16}>
                <div className={styles.emptyIcon}>
                  <Images size={40} strokeWidth={1.25} />
                </div>
                <Text as={'h2'} fontSize={22} style={{ margin: 0 }} weight={600}>
                  {t('studio.emptyTitle')}
                </Text>
                <Text type={'secondary'}>{t('studio.emptyDescription')}</Text>
                <Button onClick={onCreate}>{t('studio.backToCreate')}</Button>
              </Center>
            )}
          {orderedBatches.map((batch) => (
            <GenerationBatchItem batch={batch} key={batch.id} onReuse={onCreate} />
          ))}
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
};
