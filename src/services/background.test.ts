import { beforeEach, describe, expect, it, vi } from 'vitest';

import { backgroundService } from './background';
import { fileService } from './file';
import { uploadService } from './upload';

vi.mock('./file', () => ({ fileService: { createFile: vi.fn() } }));
vi.mock('./upload', () => ({ uploadService: { uploadFileToS3: vi.fn() } }));

describe('background upload service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(uploadService.uploadFileToS3).mockResolvedValue({
      data: {
        date: '1',
        dirname: 'backgrounds',
        filename: 'image.webp',
        path: 'backgrounds/image.webp',
      },
      success: true,
    });
    vi.mocked(fileService.createFile).mockResolvedValue({
      id: 'file_background',
      url: 'https://storage.invalid/temporary?signature=do-not-persist',
    });
  });

  it('stores a private image and persists only the stable application file route', async () => {
    const file = new File(['image-bytes'], 'crop.webp', { type: 'image/webp' });
    const image = await backgroundService.uploadImage(file, new AbortController());
    expect(image).toEqual({
      id: 'file_background',
      name: 'crop.webp',
      url: '/f/file_background',
    });
    expect(fileService.createFile).toHaveBeenCalledWith(
      expect.objectContaining({
        fileType: 'image/webp',
        name: 'crop.webp',
        source: 'global-background',
        url: 'backgrounds/image.webp',
        visibility: 'private',
      }),
    );
  });

  it('does not contact storage when already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      backgroundService.uploadImage(new File(['image'], 'crop.webp'), controller),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(uploadService.uploadFileToS3).not.toHaveBeenCalled();
  });

  it('does not create a file record after cancellation during upload', async () => {
    const controller = new AbortController();
    vi.mocked(uploadService.uploadFileToS3).mockImplementationOnce(async () => {
      controller.abort();
      return {
        data: { date: '1', dirname: 'backgrounds', filename: 'a.webp', path: 'backgrounds/a.webp' },
        success: true,
      };
    });
    await expect(
      backgroundService.uploadImage(new File(['image'], 'crop.webp'), controller),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fileService.createFile).not.toHaveBeenCalled();
  });
});
