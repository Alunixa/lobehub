'use client';

import { memo, useEffect, useRef } from 'react';
import { VirtuosoGrid } from 'react-virtuoso';

import AsyncError from '@/components/AsyncError';
import { useToolStore } from '@/store/tool';

import Item from '../Community/Item';
import Empty from '../Empty';
import Loading from '../Loading';
import { virtuosoGridStyles } from '../style';
import VirtuosoLoading from '../VirtuosoLoading';
import WantMoreSkills from '../WantMoreSkills';

export const MCPList = memo(() => {
  const [
    keywords,
    isMcpListInit,
    allItems,
    currentPage,
    totalPages,
    searchLoading,
    useFetchMCPPluginList,
    loadMoreMCPPlugins,
    resetMCPPluginList,
  ] = useToolStore((s) => [
    s.mcpSearchKeywords,
    s.isMcpListInit,
    s.mcpPluginItems,
    s.currentPage,
    s.totalPages,
    s.searchLoading,
    s.useFetchMCPPluginList,
    s.loadMoreMCPPlugins,
    s.resetMCPPluginList,
  ]);

  const prevKeywordsRef = useRef(keywords);

  useEffect(() => {
    if (prevKeywordsRef.current !== keywords) {
      prevKeywordsRef.current = keywords;
      resetMCPPluginList(keywords);
    }
  }, [keywords, resetMCPPluginList]);

  const { isLoading, error, mutate } = useFetchMCPPluginList({
    page: currentPage,
    pageSize: 20,
    q: keywords,
  });

  const hasSearchKeywords = Boolean(keywords && keywords.trim());

  if (error && allItems.length === 0) {
    return <AsyncError error={error} variant={'block'} onRetry={() => void mutate()} />;
  }

  if (searchLoading || !isMcpListInit || (isLoading && allItems.length === 0)) return <Loading />;

  if (allItems.length === 0) return <Empty search={hasSearchKeywords} />;

  const hasReachedEnd = totalPages !== undefined && currentPage >= totalPages;

  const renderFooter = () => {
    if (isLoading) return <VirtuosoLoading />;
    if (error) return <AsyncError error={error} variant={'inline'} onRetry={() => void mutate()} />;
    if (hasReachedEnd) return <WantMoreSkills />;
    return <div style={{ height: 16 }} />;
  };

  return (
    <VirtuosoGrid
      components={{ Footer: renderFooter }}
      data={allItems}
      endReached={error ? undefined : loadMoreMCPPlugins}
      increaseViewportBy={typeof window !== 'undefined' ? window.innerHeight : 0}
      itemClassName={virtuosoGridStyles.item}
      itemContent={(_, item) => <Item {...item} />}
      listClassName={virtuosoGridStyles.list}
      overscan={24}
      style={{ height: '60vh', width: '100%' }}
    />
  );
});

MCPList.displayName = 'MCPList';

export default MCPList;
