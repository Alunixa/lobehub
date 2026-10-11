import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import VideoLayout from './index';

const generationLayoutMock = vi.fn((_props: unknown) => null);

vi.mock('@/features/VideoStudio', () => ({
  VideoStudioLayout: (props: unknown) => generationLayoutMock(props),
}));

vi.mock('./Sidebar', () => ({
  default: () => <div data-testid="video-sidebar" />,
}));

describe('VideoLayout', () => {
  it('delegates to the shared video studio lifecycle and layout', () => {
    render(<VideoLayout />);

    expect(generationLayoutMock).toHaveBeenCalled();
  });
});
