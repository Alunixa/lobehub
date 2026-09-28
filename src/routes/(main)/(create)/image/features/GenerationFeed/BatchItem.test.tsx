import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AsyncTaskStatus } from '@/types/asyncTask';
import type { GenerationBatch } from '@/types/generation';

import { GenerationBatchItem } from './BatchItem';

const mocks = vi.hoisted(() => ({
  messageError: vi.fn(),
  messageSuccess: vi.fn(),
  openRetryModelModal: vi.fn(),
  recreateImage: vi.fn(),
  reuseSettings: vi.fn(),
}));

let enabledModels: Array<{ children: Array<{ id: string }>; id: string }> = [];
let imageStoreState: Record<string, unknown> = {};

vi.mock('@formkit/auto-animate/react', () => ({
  useAutoAnimate: () => [vi.fn()],
}));

vi.mock('@lobehub/icons', () => ({
  ModelTag: ({ model }: { model: string }) => <span>{model}</span>,
}));

vi.mock('@lobehub/ui', () => ({
  ActionIconGroup: () => <div data-testid={'action-icon-group'} />,
  Block: ({ children }: PropsWithChildren) => <div>{children}</div>,
  Flexbox: ({ children }: PropsWithChildren) => <div>{children}</div>,
  Image: { PreviewGroup: ({ children }: PropsWithChildren) => <div>{children}</div> },
  Markdown: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@lobehub/ui/base-ui', () => ({
  Button: ({ children, onClick }: PropsWithChildren<{ onClick?: () => void }>) => (
    <button onClick={onClick}>{children}</button>
  ),
  Tag: ({ children }: PropsWithChildren) => <span>{children}</span>,
  Text: ({ children }: PropsWithChildren) => <span>{children}</span>,
  confirmModal: vi.fn(),
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: { error: mocks.messageError, success: mocks.messageSuccess },
    }),
  },
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    batchActions: 'batch-actions',
    batchDeleteButton: 'batch-delete',
    container: 'container',
    grid: 'grid',
    prompt: 'prompt',
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/business/client/hooks/useActiveWorkspaceId', () => ({
  useActiveWorkspaceId: () => undefined,
}));

vi.mock('@/business/client/hooks/useRenderBusinessBatchItem', () => ({
  default: () => ({ businessBatchItem: null, shouldRenderBusinessBatchItem: false }),
}));

vi.mock('@/features/ImageStudio/RetryModelModal', () => ({
  openImageRetryModelModal: mocks.openRetryModelModal,
}));

vi.mock('@/routes/(main)/(create)/features/GenerationInput', () => ({
  GenerationInvalidAPIKey: () => <div data-testid={'invalid-api-key'} />,
}));

vi.mock('@/store/aiInfra', () => ({
  aiProviderSelectors: { enabledImageModelList: (state: typeof enabledModels) => state },
  useAiInfraStore: (selector: (state: typeof enabledModels) => unknown) => selector(enabledModels),
}));

vi.mock('@/store/image', () => ({
  useImageStore: (selector: (state: typeof imageStoreState) => unknown) =>
    selector(imageStoreState),
}));

vi.mock('@/store/image/slices/generationConfig/action', () => ({
  getReusableImageConfig: () => ({ parameters: { prompt: 'historical prompt' } }),
}));

vi.mock('./GenerationItem', () => ({ GenerationItem: () => <div data-testid={'generation'} /> }));
vi.mock('./ReferenceImages', () => ({ ReferenceImages: () => null }));

const batch: GenerationBatch = {
  config: { prompt: 'historical prompt', size: '2048x1024' },
  createdAt: new Date('2026-09-28T00:00:00Z'),
  generations: [
    {
      asyncTaskId: 'task-id',
      createdAt: new Date('2026-09-28T00:00:00Z'),
      id: 'generation-id',
      task: { id: 'task-id', status: AsyncTaskStatus.Success },
    },
  ],
  id: 'batch-id',
  model: 'retired-image-model',
  prompt: 'historical prompt',
  provider: 'retired-provider',
};

describe('GenerationBatchItem retry actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enabledModels = [];
    imageStoreState = {
      activeGenerationTopicId: 'topic-id',
      isCreating: false,
      recreateImage: mocks.recreateImage,
      removeGenerationBatch: vi.fn(),
      reuseSettings: mocks.reuseSettings,
    };
  });

  it('opens model selection for both retry paths when the historical model is unavailable', () => {
    render(<GenerationBatchItem batch={batch} onReuse={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'studio.regenerate' }));
    expect(mocks.openRetryModelModal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mode: 'regenerate',
        originalModel: 'retired-image-model',
        originalProvider: 'retired-provider',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'studio.adjustAndRetry' }));
    expect(mocks.openRetryModelModal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mode: 'adjust',
        originalModel: 'retired-image-model',
        originalProvider: 'retired-provider',
      }),
    );
    expect(mocks.recreateImage).not.toHaveBeenCalled();
    expect(mocks.reuseSettings).not.toHaveBeenCalled();
  });

  it('submits a direct regeneration when the historical model is still enabled', async () => {
    enabledModels = [{ children: [{ id: 'retired-image-model' }], id: 'retired-provider' }];
    mocks.recreateImage.mockResolvedValue(undefined);

    render(<GenerationBatchItem batch={batch} />);
    fireEvent.click(screen.getByRole('button', { name: 'studio.regenerate' }));

    await waitFor(() => expect(mocks.recreateImage).toHaveBeenCalledWith('batch-id', undefined));
    expect(mocks.messageSuccess).toHaveBeenCalledWith('studio.regenerateSubmitted');
  });

  it('loads historical settings and exposes the editor for adjustment', async () => {
    enabledModels = [{ children: [{ id: 'retired-image-model' }], id: 'retired-provider' }];
    const onReuse = vi.fn();

    render(<GenerationBatchItem batch={batch} onReuse={onReuse} />);
    fireEvent.click(screen.getByRole('button', { name: 'studio.adjustAndRetry' }));

    await waitFor(() => expect(onReuse).toHaveBeenCalled());
    expect(mocks.reuseSettings).toHaveBeenCalledWith('retired-image-model', 'retired-provider', {
      prompt: 'historical prompt',
      size: '2048x1024',
    });
    expect(mocks.messageSuccess).toHaveBeenCalledWith('studio.settingsLoaded');
  });
});
