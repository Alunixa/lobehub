'use client';

import { Center, Flexbox, SearchBar } from '@lobehub/ui';
import { ActionIcon, Button, Text } from '@lobehub/ui/base-ui';
import { Film, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { studioStyles as styles } from '@/features/ImageStudio/styles';
import NavItem from '@/features/NavPanel/components/NavItem';
import { useVideoStore } from '@/store/video';

import { VideoStudioHistoryActions } from './HistoryActions';
import type { useVideoStudio } from './useVideoStudio';

export const VideoStudioHistory = ({ studio }: { studio: ReturnType<typeof useVideoStudio> }) => {
  const { t } = useTranslation(['video', 'image', 'common']);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(60);
  const topics = useVideoStore((s) => s.generationTopics);
  const loadingIds = useVideoStore((s) => s.loadingGenerationTopicIds);
  const filtered = useMemo(
    () =>
      topics.filter((topic) =>
        (topic.title || '').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
      ),
    [search, topics],
  );
  return (
    <Flexbox className={styles.history} data-testid={'video-studio-history'}>
      <Flexbox gap={12} padding={16}>
        <Flexbox horizontal align={'center'} justify={'space-between'}>
          <Text weight={600}>{t('topic.title')}</Text>
          <ActionIcon
            aria-label={t('topic.createNew')}
            disabled={studio.isCreating}
            icon={Plus}
            size={{ blockSize: 44, size: 20 }}
            onClick={studio.openNew}
          />
        </Flexbox>
        <SearchBar
          allowClear
          aria-label={t('mediaStudio.searchVideoHistory', { ns: 'common' })}
          placeholder={t('mediaStudio.searchVideoHistory', { ns: 'common' })}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setLimit(60);
          }}
        />
      </Flexbox>
      <Flexbox className={styles.scroll} gap={4} padding={'0 8px 16px'}>
        {studio.topicsQuery.error && (
          <AsyncError
            error={studio.topicsQuery.error}
            onRetry={() => studio.topicsQuery.mutate()}
          />
        )}
        {studio.topicsQuery.isLoading && !topics.length ? (
          <Center padding={24}>
            <NeuralNetworkLoading size={32} />
          </Center>
        ) : !studio.topicsQuery.error && !filtered.length ? (
          <Center gap={12} padding={24}>
            <Film size={28} />
            <Text align={'center'} type={'secondary'}>
              {search
                ? t('studio.noMatches', { ns: 'image' })
                : t('mediaStudio.videoHistoryEmpty', { ns: 'common' })}
            </Text>
            {!search && <Button onClick={studio.openNew}>{t('topic.createNew')}</Button>}
          </Center>
        ) : (
          filtered
            .slice(0, limit)
            .map((topic) => (
              <NavItem
                actions={<VideoStudioHistoryActions disabled={studio.isCreating} topic={topic} />}
                active={studio.activeTopicId === topic.id}
                className={styles.historyRow}
                description={new Date(topic.updatedAt).toLocaleDateString()}
                disabled={studio.isCreating}
                icon={<Film size={20} />}
                key={topic.id}
                loading={loadingIds.includes(topic.id)}
                title={topic.title || t('topic.untitled')}
                onClick={() => studio.selectTopic(topic.id)}
              />
            ))
        )}
        {filtered.length > limit && (
          <Button onClick={() => setLimit((current) => current + 60)}>
            {t('studio.loadMore', { ns: 'image' })}
          </Button>
        )}
      </Flexbox>
    </Flexbox>
  );
};
