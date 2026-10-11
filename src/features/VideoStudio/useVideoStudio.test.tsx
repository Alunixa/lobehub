import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { MemoryRouter, useNavigate, useSearchParams } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useVideoStore } from '@/store/video';
import type { GenerationBatch } from '@/types/generation';

import { useVideoStudio } from './useVideoStudio';

const mocks = vi.hoisted(() => ({
  createVideo: vi.fn(),
  fetchBatches: vi.fn(() => ({ isLoading: false, mutate: vi.fn() })),
  fetchTopics: vi.fn(() => ({ isLoading: false, mutate: vi.fn() })),
  setPrompt: vi.fn(),
}));

// Only the runtime/store boundary is replaced; URL hooks and subscription effects are real.
vi.mock('@/store/video', async () => {
  const { create } = await import('zustand');
  return {
    useVideoStore: create(() => ({
      activeGenerationTopicId: null as string | null,
      createVideo: mocks.createVideo,
      isCreating: false,
      isInit: true,
      openNewGenerationTopic: () => videoStore.setState({ activeGenerationTopicId: null }),
      setParamOnInput: mocks.setPrompt,
      switchGenerationTopic: (id: string) => videoStore.setState({ activeGenerationTopicId: id }),
      useFetchGenerationBatches: mocks.fetchBatches,
      useFetchGenerationTopics: mocks.fetchTopics,
    })),
  };
});
vi.mock('@/store/video/slices/generationBatch/selectors', () => ({
  generationBatchSelectors: { currentGenerationBatches: () => emptyBatches },
}));
vi.mock('@/store/user', () => ({
  useUserStore: (selector: (state: { loggedIn: boolean }) => unknown) =>
    selector({ loggedIn: true }),
}));
vi.mock('@/store/user/slices/auth/selectors', () => ({
  authSelectors: { isLogin: (state: { loggedIn: boolean }) => state.loggedIn },
}));
vi.mock('@/store/aiInfra', () => ({
  aiProviderSelectors: { enabledVideoModelList: () => [] },
  useAiInfraStore: () => [],
}));
vi.mock('@/hooks/useFetchAiVideoConfig', () => ({ useFetchAiVideoConfig: vi.fn() }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ allowed: true }) }));
vi.mock('@/components/Error/loginRequiredNotification', () => ({
  loginRequired: { redirect: vi.fn() },
}));

const videoStore = useVideoStore;
const emptyBatches: GenerationBatch[] = [];
let initialEntry = '/video';
const wrapper = ({ children }: PropsWithChildren) => (
  <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
);
const useHarness = () => {
  const studio = useVideoStudio();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  return { navigate, search, studio };
};

beforeEach(() => {
  vi.clearAllMocks();
  initialEntry = '/video';
  videoStore.setState({ activeGenerationTopicId: null, isCreating: false });
});
afterEach(() => vi.restoreAllMocks());

describe('video workspace lifecycle', () => {
  it('subscribes to history without a desktop sidebar and follows a newly accepted topic', async () => {
    const { result } = renderHook(useHarness, { wrapper });
    expect(mocks.fetchTopics).toHaveBeenCalledWith(true);
    expect(result.current.studio.view).toBe('create');
    act(() => videoStore.setState({ activeGenerationTopicId: 'gt_new' }));
    await waitFor(() => expect(result.current.search.get('topic')).toBe('gt_new'));
    expect(result.current.studio.view).toBe('results');
    expect(mocks.fetchBatches).toHaveBeenCalledWith('gt_new');
    act(() => result.current.studio.setView('history'));
    expect(result.current.studio.view).toBe('history');
    act(() => result.current.studio.setView('create'));
    expect(result.current.studio.view).toBe('create');
  });

  it('honors direct links and browser navigation without restoring a stale topic', async () => {
    initialEntry = '/video?topic=gt_original';
    const { result } = renderHook(useHarness, { wrapper });
    await waitFor(() => expect(videoStore.getState().activeGenerationTopicId).toBe('gt_original'));
    act(() => result.current.navigate('/video?topic=gt_next'));
    await waitFor(() => expect(videoStore.getState().activeGenerationTopicId).toBe('gt_next'));
    act(() => result.current.navigate(-1));
    await waitFor(() => expect(videoStore.getState().activeGenerationTopicId).toBe('gt_original'));
  });

  it('shows submission immediately and preserves an explicit error without resubmitting', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const pending = Promise.withResolvers<void>();
    mocks.createVideo.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(useHarness, { wrapper });
    let generate: Promise<void>;
    act(() => {
      generate = result.current.studio.generate();
    });
    expect(result.current.studio.view).toBe('results');
    await act(async () => {
      pending.reject(new Error('request offline'));
      await generate;
    });
    expect(result.current.studio.submitError).toBeInstanceOf(Error);
    expect(mocks.createVideo).toHaveBeenCalledTimes(1);
  });

  it('prefills percent signs safely without issuing a paid request', async () => {
    initialEntry = '/video?prompt=100%25%20orange';
    const { result } = renderHook(useHarness, { wrapper });
    await waitFor(() => expect(result.current.search.has('prompt')).toBe(false));
    expect(mocks.setPrompt).toHaveBeenCalledWith('prompt', '100% orange');
    expect(mocks.createVideo).not.toHaveBeenCalled();
    expect(result.current.studio.view).toBe('create');
  });
});
