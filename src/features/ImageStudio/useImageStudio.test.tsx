import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { MemoryRouter, useNavigate, useSearchParams } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useImageStore } from '@/store/image';
import type { GenerationBatch } from '@/types/generation';

import { useImageStudio } from './useImageStudio';

const mocks = vi.hoisted(() => ({
  createImage: vi.fn(),
  fetchBatches: vi.fn(() => ({ isLoading: false, mutate: vi.fn() })),
  fetchTopics: vi.fn(() => ({ isLoading: false, mutate: vi.fn() })),
  setPrompt: vi.fn(),
}));

// Only the runtime/store boundary is replaced; URL hooks and subscription effects are real.
vi.mock('@/store/image', async () => {
  const { create } = await import('zustand');
  return {
    useImageStore: create(() => ({
      activeGenerationTopicId: null as string | null,
      createImage: mocks.createImage,
      isCreating: false,
      isInit: true,
      openNewGenerationTopic: () => imageStore.setState({ activeGenerationTopicId: null }),
      setParamOnInput: mocks.setPrompt,
      switchGenerationTopic: (id: string) => imageStore.setState({ activeGenerationTopicId: id }),
      useFetchGenerationBatches: mocks.fetchBatches,
      useFetchGenerationTopics: mocks.fetchTopics,
    })),
  };
});
vi.mock('@/store/image/selectors', () => ({
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
  aiProviderSelectors: { enabledImageModelList: () => [] },
  useAiInfraStore: () => [],
}));
vi.mock('@/hooks/useFetchAiImageConfig', () => ({ useFetchAiImageConfig: vi.fn() }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ allowed: true }) }));
vi.mock('@/components/Error/loginRequiredNotification', () => ({
  loginRequired: { redirect: vi.fn() },
}));

const imageStore = useImageStore;
const emptyBatches: GenerationBatch[] = [];
let initialEntry = '/image';
const wrapper = ({ children }: PropsWithChildren) => (
  <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
);
const useHarness = () => {
  const studio = useImageStudio();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  return { navigate, search, studio };
};

beforeEach(() => {
  vi.clearAllMocks();
  initialEntry = '/image';
  imageStore.setState({ activeGenerationTopicId: null, isCreating: false });
});
afterEach(() => vi.restoreAllMocks());

describe('image workspace lifecycle', () => {
  it('subscribes to history without a desktop sidebar and follows a newly accepted topic', async () => {
    const { result } = renderHook(useHarness, { wrapper });
    expect(mocks.fetchTopics).toHaveBeenCalledWith(true);
    expect(result.current.studio.view).toBe('create');
    act(() => imageStore.setState({ activeGenerationTopicId: 'gt_new' }));
    await waitFor(() => expect(result.current.search.get('topic')).toBe('gt_new'));
    expect(result.current.studio.view).toBe('results');
    expect(mocks.fetchBatches).toHaveBeenCalledWith('gt_new');
    act(() => result.current.studio.setView('history'));
    expect(result.current.studio.view).toBe('history');
    act(() => result.current.studio.setView('create'));
    expect(result.current.studio.view).toBe('create');
  });

  it('honors direct links and browser navigation without restoring a stale topic', async () => {
    initialEntry = '/image?topic=gt_original';
    const { result } = renderHook(useHarness, { wrapper });
    await waitFor(() => expect(imageStore.getState().activeGenerationTopicId).toBe('gt_original'));
    act(() => result.current.navigate('/image?topic=gt_next'));
    await waitFor(() => expect(imageStore.getState().activeGenerationTopicId).toBe('gt_next'));
    act(() => result.current.navigate(-1));
    await waitFor(() => expect(imageStore.getState().activeGenerationTopicId).toBe('gt_original'));
  });

  it('shows submission immediately and preserves an explicit error without resubmitting', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const pending = Promise.withResolvers<void>();
    mocks.createImage.mockReturnValueOnce(pending.promise);
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
    expect(mocks.createImage).toHaveBeenCalledTimes(1);
  });

  it('prefills percent signs safely without issuing a paid request', async () => {
    initialEntry = '/image?prompt=100%25%20orange';
    const { result } = renderHook(useHarness, { wrapper });
    await waitFor(() => expect(result.current.search.has('prompt')).toBe(false));
    expect(mocks.setPrompt).toHaveBeenCalledWith('prompt', '100% orange');
    expect(mocks.createImage).not.toHaveBeenCalled();
    expect(result.current.studio.view).toBe('create');
  });
});
