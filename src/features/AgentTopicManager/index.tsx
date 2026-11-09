'use client';

import {
  getTopicWorkingDirectorySourcePath,
  groupTopicsByProject,
  groupTopicsByUpdatedTime,
} from '@lobechat/utils/client/topic';
import { Flexbox, Skeleton } from '@lobehub/ui';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import urlJoin from 'url-join';

import AsyncError from '@/components/AsyncError';
import Loading from '@/components/Loading/BrandTextLoading';
import { useQueryRoute } from '@/hooks/useQueryRoute';
import { useQuery } from '@/libs/router/navigation';
import { useChatStore } from '@/store/chat';
import { topicSelectors } from '@/store/chat/selectors';
import { shinyTextStyles } from '@/styles/loading';
import type { ChatTopic } from '@/types/topic';

import BulkActionBar from './BulkActionBar';
import EmptyState from './EmptyState';
import Header from './Header';
import { useTopicsViewStore } from './store';
import Toolbar from './Toolbar';
import TopicGrid from './TopicGrid';
import TopicListView from './TopicListView';
import {
  getProjectFilterLabel,
  matchesGroup,
  matchesStatus,
  matchesTimeRange,
  matchesTrigger,
  parseTopicManagerStatus,
  sortTopics,
} from './utils';

// Start small so users see infinite scroll kick in; each scroll-to-bottom
// triggers `loadMoreTopics` which appends another page into `topicDataMap`.
const PAGE_SIZE = 30;

const AgentTopicManager = memo(() => {
  const { t } = useTranslation('topic');
  const activeAgentId = useChatStore((s) => s.activeAgentId);
  const query = useQuery();
  const routeStatus = parseTopicManagerStatus(query.status);
  const queryRoute = useQueryRoute();
  // Use the management page's dedicated SWR pipeline so the heavier
  // `withDetails` fetch doesn't share a bucket with the sidebar's cheap
  // fetch (the shared bucket let whichever response landed last clobber the
  // other).
  const useFetchAgentTopicsView = useChatStore((s) => s.useFetchAgentTopicsView);
  const useFetchCompletedTopicsView = useChatStore((s) => s.useFetchCompletedTopicsView);
  const useSearchTopics = useChatStore((s) => s.useSearchTopics);
  const loadMoreAgentTopicsView = useChatStore((s) => s.loadMoreAgentTopicsView);
  const loadMoreCompletedTopicsView = useChatStore((s) => s.loadMoreCompletedTopicsView);

  // Read directly from the view's topic map so `loadMore` appends are visible
  // here without waiting for SWR revalidation.
  const allTopics = useChatStore(topicSelectors.agentTopicsViewTopics);
  const completedTopics = useChatStore(topicSelectors.completedTopicsViewTopics);
  const hasMore = useChatStore(topicSelectors.agentTopicsViewHasMore);
  const completedHasMore = useChatStore(topicSelectors.completedTopicsViewHasMore);
  const isLoadingMore = useChatStore(topicSelectors.agentTopicsViewIsLoadingMore);
  const isLoadingMoreCompleted = useChatStore(topicSelectors.completedTopicsViewIsLoadingMore);
  const loadMoreError = useChatStore(topicSelectors.agentTopicsViewLoadMoreError);
  const completedLoadMoreError = useChatStore(topicSelectors.completedTopicsViewLoadMoreError);
  const completedTotal = useChatStore(topicSelectors.completedTopicsViewTotal);

  const reset = useTopicsViewStore((s) => s.reset);
  const search = useTopicsViewStore((s) => s.search);
  const status = useTopicsViewStore((s) => s.status);
  const groupIds = useTopicsViewStore((s) => s.groupIds);
  const triggers = useTopicsViewStore((s) => s.triggers);
  const timeRange = useTopicsViewStore((s) => s.timeRange);
  const sortBy = useTopicsViewStore((s) => s.sortBy);
  const groupBy = useTopicsViewStore((s) => s.groupBy);
  const viewMode = useTopicsViewStore((s) => s.viewMode);
  const setStatus = useTopicsViewStore((s) => s.setStatus);
  const setGroupIds = useTopicsViewStore((s) => s.setGroupIds);
  const setTriggers = useTopicsViewStore((s) => s.setTriggers);
  const setTimeRange = useTopicsViewStore((s) => s.setTimeRange);
  const setSearch = useTopicsViewStore((s) => s.setSearch);

  const trimmedSearch = search.trim();
  const isSearchMode = trimmedSearch.length > 0;

  // Reset whenever the agent context switches AND on unmount. The route
  // `/agent/:aid/topics` reuses the same component instance across agent
  // navigations, so an unmount-only cleanup would let `selectedIds` (and
  // other view state) from the previous agent persist into the next one —
  // which would mean a bulk Delete/Archive/Favorite click silently targets
  // stale IDs from another agent.
  useEffect(() => {
    reset();
  }, [activeAgentId, reset]);

  useEffect(() => {
    setStatus(routeStatus);
  }, [activeAgentId, routeStatus, setStatus]);

  const allTopicsView = useFetchAgentTopicsView(true, {
    agentId: activeAgentId,
    pageSize: PAGE_SIZE,
    // Opt into the heavier card-detail columns (firstUserMessage,
    // messageCount, cost, tokenUsage, description, trigger). Sidebar paths
    // omit this so their query stays cheap.
    withDetails: true,
  });

  const completedTopicsView = useFetchCompletedTopicsView(
    routeStatus === 'completed' && !isSearchMode,
    {
      agentId: activeAgentId,
      pageSize: PAGE_SIZE,
      withDetails: true,
    },
  );
  const isCompletedMode = routeStatus === 'completed' && !isSearchMode;
  const currentError = isCompletedMode ? completedTopicsView.error : allTopicsView.error;
  const isLoading = isCompletedMode
    ? !completedTopicsView.isHydrated || completedTopicsView.isValidating
    : !allTopicsView.isHydrated || allTopicsView.isValidating;
  const currentHasMore = isCompletedMode ? completedHasMore : hasMore;
  const currentIsLoadingMore = isCompletedMode ? isLoadingMoreCompleted : isLoadingMore;
  const currentLoadMoreError = isCompletedMode ? completedLoadMoreError : loadMoreError;
  const loadMoreCurrentView = isCompletedMode
    ? loadMoreCompletedTopicsView
    : loadMoreAgentTopicsView;

  const { data: searchResults } = useSearchTopics(isSearchMode ? trimmedSearch : undefined, {
    agentId: activeAgentId,
  });

  const baseTopics: ChatTopic[] = useMemo(() => {
    if (isSearchMode) return searchResults ?? [];
    return isCompletedMode ? completedTopics : (allTopics ?? []);
  }, [isSearchMode, searchResults, isCompletedMode, completedTopics, allTopics]);

  const statusCountTopics = useMemo(
    () => (isSearchMode ? baseTopics : (allTopics ?? [])),
    [isSearchMode, baseTopics, allTopics],
  );

  const statusCountPool = useMemo(
    () =>
      statusCountTopics.filter(
        (topic) =>
          matchesGroup(topic, groupIds) &&
          matchesTrigger(topic, triggers) &&
          matchesTimeRange(topic, timeRange),
      ),
    [statusCountTopics, groupIds, triggers, timeRange],
  );

  // Pool with every filter EXCEPT status applied. Reused for the final
  // filtered list AND for the per-status count badges so each tab shows
  // "what you'd see if you switched here with the same other filters".
  const preStatusPool = useMemo(
    () =>
      baseTopics.filter(
        (t) =>
          matchesGroup(t, groupIds) &&
          matchesTrigger(t, triggers) &&
          matchesTimeRange(t, timeRange),
      ),
    [baseTopics, groupIds, triggers, timeRange],
  );

  const filtered = useMemo(() => {
    const out = preStatusPool.filter((t) => matchesStatus(t, status));
    return sortTopics(out, sortBy);
  }, [preStatusPool, status, sortBy]);

  const statusCounts = useMemo(
    () => ({
      active: statusCountPool.filter((t) => matchesStatus(t, 'active')).length,
      all: statusCountPool.length,
      // 'archived' has no visible tab today, but StatusFilter still includes it
      // — count it so the Record satisfies the type for any future tab.
      archived: statusCountPool.filter((t) => matchesStatus(t, 'archived')).length,
      completed:
        !isSearchMode && groupIds.length === 0 && triggers.length === 0 && timeRange === 'all'
          ? (completedTotal ?? statusCountPool.filter((t) => matchesStatus(t, 'completed')).length)
          : statusCountPool.filter((t) => matchesStatus(t, 'completed')).length,
      running: statusCountPool.filter((t) => matchesStatus(t, 'running')).length,
    }),
    [statusCountPool, completedTotal, isSearchMode, groupIds, triggers, timeRange],
  );

  // Search results are flat — grouping by time confuses the relevance order
  // returned by the BM25 keyword search.
  const useGroups = groupBy !== 'none' && !isSearchMode;

  const renderGroups = useMemo(() => {
    if (!useGroups) return [{ children: filtered, id: 'all' }];
    if (groupBy === 'byProject') {
      const field: 'createdAt' | 'updatedAt' = sortBy === 'createdAt' ? 'createdAt' : 'updatedAt';
      return groupTopicsByProject(filtered, field);
    }
    return groupTopicsByUpdatedTime(filtered);
  }, [filtered, useGroups, groupBy, sortBy]);

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of baseTopics) {
      const wd = getTopicWorkingDirectorySourcePath(t);
      if (wd && !map.has(wd)) {
        map.set(wd, getProjectFilterLabel(t) ?? wd);
      }
    }
    return Array.from(map, ([value, label]) => ({ label, value }));
  }, [baseTopics]);

  const totalAfterFilter = filtered.length;
  // 'active' is the default tab, so it doesn't count as a user-applied filter
  const hasActiveFilters =
    (status !== 'active' && status !== 'all') ||
    groupIds.length > 0 ||
    triggers.length > 0 ||
    timeRange !== 'all' ||
    trimmedSearch.length > 0;

  const handleStatusChange = useCallback(
    (nextStatus: Parameters<typeof setStatus>[0]) => {
      setStatus(nextStatus);
      if (!activeAgentId) return;

      queryRoute.replace(urlJoin('/agent', activeAgentId, 'topics'), {
        query: nextStatus === 'active' ? {} : { status: nextStatus },
        replace: true,
      });
    },
    [activeAgentId, queryRoute, setStatus],
  );

  const clearFilters = () => {
    // "Clear filters" jumps to All so users can confirm there really is no
    // matching topic in the entire dataset; the default Active landing is
    // only for first visits.
    handleStatusChange('all');
    setGroupIds([]);
    setTriggers([]);
    setTimeRange('all');
    setSearch('');
  };

  // Infinite scroll — observe a sentinel near the end of the list. We pass
  // the scroll container as the IntersectionObserver `root` so detection is
  // tied to the in-page scroll position, not the window viewport (otherwise
  // a tall window can leave the sentinel "always intersecting" or never
  // intersecting, depending on layout).
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isSearchMode) return;
    const root = scrollContainerRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          entry.isIntersecting &&
          currentHasMore &&
          !currentIsLoadingMore &&
          !currentLoadMoreError
        ) {
          void loadMoreCurrentView();
        }
      },
      { root, rootMargin: '300px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    currentHasMore,
    currentIsLoadingMore,
    isSearchMode,
    loadMoreCurrentView,
    currentLoadMoreError,
  ]);

  if (!activeAgentId) return <Loading debugId="AgentTopicManager" />;

  return (
    <Flexbox flex={1} height={'100%'} style={{ overflow: 'hidden' }}>
      <Header agentId={activeAgentId} />
      <div
        ref={scrollContainerRef}
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          minWidth: 0,
          overflowY: 'auto',
          padding: '20px 24px',
        }}
      >
        <Flexbox
          gap={16}
          style={{
            marginInline: 'auto',
            maxWidth: 1440,
            width: '100%',
          }}
        >
          <Toolbar
            projects={projects}
            statusCounts={statusCounts}
            onStatusChange={handleStatusChange}
          />
          <BulkActionBar />
          {!isSearchMode && currentError && !isLoading && baseTopics.length === 0 ? (
            <AsyncError
              error={currentError}
              variant={'block'}
              onRetry={() => {
                void (isCompletedMode ? completedTopicsView.mutate() : allTopicsView.mutate());
              }}
            />
          ) : isLoading && baseTopics.length === 0 ? (
            <Skeleton active paragraph={{ rows: 6 }} title={false} />
          ) : totalAfterFilter === 0 ? (
            <>
              <EmptyState
                agentId={activeAgentId}
                hasFilters={hasActiveFilters}
                onClearFilters={clearFilters}
              />
              {!isSearchMode && currentHasMore && (
                <div aria-hidden ref={sentinelRef} style={{ height: 1 }} />
              )}
              {!isSearchMode && currentIsLoadingMore && (
                <Flexbox align={'center'} paddingBlock={12}>
                  <span className={shinyTextStyles.shinyText} style={{ fontSize: 12 }}>
                    {t('management.loadingMore')}
                  </span>
                </Flexbox>
              )}
              {!isSearchMode && currentLoadMoreError && !currentIsLoadingMore && (
                <Flexbox align={'center'} paddingBlock={12}>
                  <AsyncError
                    error={currentLoadMoreError}
                    variant={'inline'}
                    onRetry={() => {
                      void loadMoreCurrentView();
                    }}
                  />
                </Flexbox>
              )}
            </>
          ) : (
            <>
              {viewMode === 'card' ? (
                <TopicGrid
                  agentId={activeAgentId}
                  groupBy={groupBy}
                  groups={renderGroups}
                  showGroupTitles={useGroups}
                />
              ) : (
                <TopicListView
                  agentId={activeAgentId}
                  groupBy={groupBy}
                  groups={renderGroups}
                  showGroupTitles={useGroups}
                />
              )}
              {!isSearchMode && currentHasMore && (
                <div aria-hidden ref={sentinelRef} style={{ height: 1 }} />
              )}
              {!isSearchMode && currentIsLoadingMore && (
                <Flexbox align={'center'} paddingBlock={12}>
                  <span className={shinyTextStyles.shinyText} style={{ fontSize: 12 }}>
                    {t('management.loadingMore')}
                  </span>
                </Flexbox>
              )}
              {!isSearchMode && currentLoadMoreError && !currentIsLoadingMore && (
                <Flexbox align={'center'} paddingBlock={12}>
                  <AsyncError
                    error={currentLoadMoreError}
                    variant={'inline'}
                    onRetry={() => {
                      void loadMoreCurrentView();
                    }}
                  />
                </Flexbox>
              )}
            </>
          )}
        </Flexbox>
      </div>
    </Flexbox>
  );
});

AgentTopicManager.displayName = 'AgentTopicManager';

export default AgentTopicManager;
