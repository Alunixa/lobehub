'use client';

import { ActionIcon, Avatar, Center, Flexbox, SearchBar, Text } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { ImageIcon, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import NavItem from '@/features/NavPanel/components/NavItem';
import { useImageStore } from '@/store/image';

import { StudioHistoryActions } from './HistoryActions';
import { studioStyles as styles } from './styles';
import type { useImageStudio } from './useImageStudio';

interface StudioHistoryProps {
  disabled: boolean;
  onNew: () => void;
  onSelect: (id: string) => void;
  query: ReturnType<typeof useImageStudio>['topicsQuery'];
}

export const StudioHistory = ({ disabled, onNew, onSelect, query }: StudioHistoryProps) => {
  const { t } = useTranslation('image');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(60);
  const topics = useImageStore((s) => s.generationTopics);
  const activeId = useImageStore((s) => s.activeGenerationTopicId);
  const loadingIds = useImageStore((s) => s.loadingGenerationTopicIds);
  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    return topics.filter((topic) => (topic.title || '').toLocaleLowerCase().includes(keyword));
  }, [search, topics]);

  return (
    <Flexbox className={styles.history} data-testid={'studio-history'}>
      <Flexbox gap={12} padding={16}>
        <Flexbox horizontal align={'center'} justify={'space-between'}>
          <Text weight={600}>{t('studio.history')}</Text>
          <ActionIcon
            aria-label={t('topic.createNew')}
            disabled={disabled}
            icon={Plus}
            size={{ blockSize: 44, size: 20 }}
            onClick={onNew}
          />
        </Flexbox>
        <SearchBar
          allowClear
          aria-label={t('studio.searchHistory')}
          placeholder={t('studio.searchHistory')}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setLimit(60);
          }}
        />
      </Flexbox>
      <Flexbox className={styles.scroll} gap={4} padding={'0 8px 16px'}>
        {query.error && <AsyncError error={query.error} onRetry={() => query.mutate()} />}
        {query.isLoading && !topics.length ? (
          <Center padding={24}>
            <NeuralNetworkLoading size={32} />
          </Center>
        ) : !query.error && !filtered.length ? (
          <Center gap={12} padding={24}>
            <ImageIcon size={28} />
            <Text align={'center'} type={'secondary'}>
              {search ? t('studio.noMatches') : t('studio.historyEmpty')}
            </Text>
            {!search && <Button onClick={onNew}>{t('topic.createNew')}</Button>}
          </Center>
        ) : (
          filtered.slice(0, limit).map((topic) => (
            <NavItem
              actions={<StudioHistoryActions disabled={disabled} topic={topic} />}
              active={activeId === topic.id}
              className={styles.historyRow}
              disabled={disabled}
              icon={<Avatar avatar={topic.coverUrl ?? ''} shape={'square'} size={40} />}
              key={topic.id}
              loading={loadingIds.includes(topic.id)}
              title={topic.title || t('topic.untitled')}
              description={
                <Text fontSize={12} type={'secondary'}>
                  {new Date(topic.updatedAt).toLocaleDateString()} ·{' '}
                  {topic.visibility === 'public'
                    ? t('topic.workspaceTitle')
                    : t('topic.privateTitle')}
                </Text>
              }
              onClick={() => onSelect(topic.id)}
            />
          ))
        )}
        {filtered.length > limit && (
          <Button onClick={() => setLimit((current) => current + 60)}>
            {t('studio.loadMore')}
          </Button>
        )}
      </Flexbox>
    </Flexbox>
  );
};
