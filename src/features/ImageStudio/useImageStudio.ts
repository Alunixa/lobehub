'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { loginRequired } from '@/components/Error/loginRequiredNotification';
import { useFetchAiImageConfig } from '@/hooks/useFetchAiImageConfig';
import { usePermission } from '@/hooks/usePermission';
import { useQueryState } from '@/hooks/useQueryParam';
import { aiProviderSelectors, useAiInfraStore } from '@/store/aiInfra';
import { useImageStore } from '@/store/image';
import { generationBatchSelectors } from '@/store/image/selectors';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/slices/auth/selectors';
import { AsyncTaskStatus } from '@/types/asyncTask';

export type StudioView = 'create' | 'results' | 'history';

/**
 * The workspace owns its data and navigation lifecycle, never a conditional sidebar.
 * Keep this mounted while switching mobile tabs so accepted tasks remain observable.
 */
export const useImageStudio = () => {
  const [topic, setTopic] = useQueryState('topic', { history: 'replace' });
  const [view, setView] = useState<StudioView>(topic ? 'results' : 'create');
  const [submitError, setSubmitError] = useState<unknown>();
  const isLogin = useUserStore(authSelectors.isLogin);
  const { allowed: canCreate } = usePermission('create_content');
  const activeTopicId = useImageStore((s) => s.activeGenerationTopicId);
  const isCreating = useImageStore((s) => s.isCreating);
  const isInit = useImageStore((s) => s.isInit);
  const fetchTopics = useImageStore((s) => s.useFetchGenerationTopics);
  const fetchBatches = useImageStore((s) => s.useFetchGenerationBatches);
  const topicsQuery = fetchTopics(!!isLogin);
  const batchesQuery = fetchBatches(isLogin ? activeTopicId : null);
  const batches = useImageStore(generationBatchSelectors.currentGenerationBatches);

  useFetchAiImageConfig();

  useLayoutEffect(() => {
    useImageStore.setState({ activeGenerationTopicId: topic ?? null });
  }, [topic]);

  useLayoutEffect(
    () =>
      useImageStore.subscribe((state, previous) => {
        if (state.activeGenerationTopicId === previous.activeGenerationTopicId) return;
        setTopic(state.activeGenerationTopicId || null);
        setView(state.activeGenerationTopicId ? 'results' : 'create');
      }),
    [setTopic],
  );

  // URL navigation (including Back/Forward) selects the associated result view.
  useEffect(() => {
    setView(topic ? 'results' : 'create');
  }, [topic]);

  const [searchParams, setSearchParams] = useSearchParams();
  const enabledModels = useAiInfraStore(aiProviderSelectors.enabledImageModelList);
  const processedPrefill = useRef(false);
  useEffect(() => {
    if (!isInit || processedPrefill.current) return;
    const prompt = searchParams.get('prompt');
    const model = searchParams.get('model');
    if (!prompt && !model) return;
    processedPrefill.current = true;
    const store = useImageStore.getState();
    if (model) {
      const provider = enabledModels.find((group) =>
        group.children.some((item) => item.id === model),
      );
      if (provider) store.setModelAndProviderOnSelect(model, provider.id);
    }
    // URLSearchParams already decodes text; never decode '%' a second time.
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
  }, [canCreate, enabledModels, isInit, searchParams, setSearchParams]);

  const generate = useCallback(async () => {
    if (!canCreate || useImageStore.getState().isCreating) return;
    if (!isLogin) {
      loginRequired.redirect({ timeout: 2000 });
      return;
    }
    setSubmitError(undefined);
    setView('results');
    try {
      await useImageStore.getState().createImage();
    } catch (error) {
      console.error('Image submission failed:', error);
      setSubmitError(error);
    }
  }, [canCreate, isLogin]);

  const openNew = useCallback(() => {
    if (useImageStore.getState().isCreating) return;
    useImageStore.getState().openNewGenerationTopic();
    setSubmitError(undefined);
    setView('create');
  }, []);

  const selectTopic = useCallback((id: string) => {
    if (useImageStore.getState().isCreating) return;
    useImageStore.getState().switchGenerationTopic(id);
    setSubmitError(undefined);
    setView('results');
  }, []);

  const counts = useMemo(() => {
    const generations = batches.flatMap((batch) => batch.generations);
    return {
      failed: generations.filter((item) => item.task.status === AsyncTaskStatus.Error).length,
      pending: generations.filter(
        (item) =>
          item.task.status === AsyncTaskStatus.Pending ||
          item.task.status === AsyncTaskStatus.Processing,
      ).length,
      success: generations.filter((item) => item.task.status === AsyncTaskStatus.Success).length,
      total: generations.length,
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
