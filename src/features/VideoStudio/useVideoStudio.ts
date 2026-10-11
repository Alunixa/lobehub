'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { loginRequired } from '@/components/Error/loginRequiredNotification';
import type { StudioView } from '@/features/ImageStudio/useImageStudio';
import { useFetchAiVideoConfig } from '@/hooks/useFetchAiVideoConfig';
import { usePermission } from '@/hooks/usePermission';
import { useQueryState } from '@/hooks/useQueryParam';
import { aiProviderSelectors, useAiInfraStore } from '@/store/aiInfra';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/slices/auth/selectors';
import { useVideoStore } from '@/store/video';
import { generationBatchSelectors } from '@/store/video/slices/generationBatch/selectors';
import { AsyncTaskStatus } from '@/types/asyncTask';

export const useVideoStudio = () => {
  const [topic, setTopic] = useQueryState('topic', { history: 'replace' });
  const [view, setView] = useState<StudioView>(topic ? 'results' : 'create');
  const [submitError, setSubmitError] = useState<unknown>();
  const isLogin = useUserStore(authSelectors.isLogin);
  const { allowed: canCreate } = usePermission('create_content');
  const activeTopicId = useVideoStore((s) => s.activeGenerationTopicId);
  const isCreating = useVideoStore((s) => s.isCreating);
  const isInit = useVideoStore((s) => s.isInit);
  const fetchTopics = useVideoStore((s) => s.useFetchGenerationTopics);
  const fetchBatches = useVideoStore((s) => s.useFetchGenerationBatches);
  const topicsQuery = fetchTopics(!!isLogin);
  const batchesQuery = fetchBatches(isLogin ? activeTopicId : null);
  const batches = useVideoStore(generationBatchSelectors.currentGenerationBatches);
  useFetchAiVideoConfig();

  useLayoutEffect(() => {
    useVideoStore.setState({ activeGenerationTopicId: topic ?? null });
  }, [topic]);
  useLayoutEffect(
    () =>
      useVideoStore.subscribe((state, previous) => {
        if (state.activeGenerationTopicId === previous.activeGenerationTopicId) return;
        setTopic(state.activeGenerationTopicId || null);
        setView(state.activeGenerationTopicId ? 'results' : 'create');
      }),
    [setTopic],
  );
  useEffect(() => setView(topic ? 'results' : 'create'), [topic]);

  const [searchParams, setSearchParams] = useSearchParams();
  const models = useAiInfraStore(aiProviderSelectors.enabledVideoModelList);
  const processedPrefill = useRef(false);
  useEffect(() => {
    if (!isInit || processedPrefill.current) return;
    const prompt = searchParams.get('prompt');
    const model = searchParams.get('model');
    if (!prompt && !model) return;
    processedPrefill.current = true;
    const store = useVideoStore.getState();
    const provider = models.find((group) => group.children.some((item) => item.id === model));
    if (model && provider) store.setModelAndProviderOnSelect(model, provider.id);
    if (prompt && canCreate) store.setParamOnInput('prompt', prompt);
    setView('create');
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('prompt');
        next.delete('model');
        return next;
      },
      { replace: true },
    );
  }, [canCreate, isInit, models, searchParams, setSearchParams]);

  const generate = useCallback(async () => {
    if (!canCreate || useVideoStore.getState().isCreating) return;
    if (!isLogin) {
      loginRequired.redirect({ timeout: 2000 });
      return;
    }
    setSubmitError(undefined);
    setView('results');
    try {
      await useVideoStore.getState().createVideo();
    } catch (error) {
      console.error('Video submission failed:', error);
      setSubmitError(error);
    }
  }, [canCreate, isLogin]);
  const openNew = useCallback(() => {
    if (useVideoStore.getState().isCreating) return;
    useVideoStore.getState().openNewGenerationTopic();
    setSubmitError(undefined);
    setView('create');
  }, []);
  const selectTopic = useCallback((id: string) => {
    if (useVideoStore.getState().isCreating) return;
    useVideoStore.getState().switchGenerationTopic(id);
    setSubmitError(undefined);
    setView('results');
  }, []);
  const counts = useMemo(() => {
    const all = batches.flatMap((batch) => batch.generations);
    return {
      failed: all.filter((item) => item.task.status === AsyncTaskStatus.Error).length,
      pending: all.filter(
        (item) =>
          item.task.status === AsyncTaskStatus.Pending ||
          item.task.status === AsyncTaskStatus.Processing,
      ).length,
      success: all.filter((item) => item.task.status === AsyncTaskStatus.Success).length,
      total: all.length,
    };
  }, [batches]);
  return {
    activeTopicId,
    batches,
    batchesQuery,
    canCreate,
    counts,
    generate,
    isCreating,
    isInit,
    openNew,
    selectTopic,
    setView,
    submitError,
    topicsQuery,
    view,
  };
};
