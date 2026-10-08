// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UPLOAD_NETWORK_ERROR, uploadService } from '@/services/upload';
import {
  isSupportedChatUploadFile,
  videoMimeFromExtension,
} from '@/store/file/slices/chat/uploadGuard';
import { createChatUploadPreview } from '@/store/file/slices/chat/uploadPreview';

vi.mock('@/envs/file', () => ({ fileEnv: { NEXT_PUBLIC_S3_FILE_PATH: 'fixture' } }));
vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    upload: { createS3PreSignedUrl: { mutate: async () => 'https://storage.test/upload' } },
  },
}));

const instances: UploadXHR[] = [];
class UploadXHR extends EventTarget {
  upload = new EventTarget();
  timeout = 0;
  status = 200;
  response = '';
  statusText = 'OK';
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  abort = vi.fn(() => this.dispatchEvent(new Event('abort')));
  constructor() {
    super();
    instances.push(this);
  }
}
afterEach(() => {
  instances.splice(0);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('video upload reliability', () => {
  it('accepts valid video extensions when the browser omits their MIME type', () => {
    expect(videoMimeFromExtension('recording.MP4')).toBe('video/mp4');
    expect(videoMimeFromExtension('clip.mov')).toBe('video/quicktime');
    expect(isSupportedChatUploadFile(new File(['video'], 'clip.mp4', { type: '' }))).toBe(true);
    expect(
      isSupportedChatUploadFile(
        new File(['video'], 'clip.webm', { type: 'application/octet-stream' }),
      ),
    ).toBe(true);
  });

  it('previews a video without reading and Base64-encoding its complete contents', async () => {
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' });
    const read = vi.fn();
    Object.defineProperty(file, 'arrayBuffer', { value: read });
    const objectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:video');
    expect(await createChatUploadPreview(file)).toEqual({ previewUrl: 'blob:video' });
    expect(read).not.toHaveBeenCalled();
    expect(objectURL).toHaveBeenCalledWith(file);
  });

  it('uploads the original Blob directly and finishes after storage acknowledges it', async () => {
    vi.stubGlobal('XMLHttpRequest', UploadXHR);
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' });
    const pending = uploadService.uploadToServerS3(file, {});
    await vi.waitFor(() => expect(instances[0]?.send).toHaveBeenCalledWith(file));
    expect(instances[0].timeout).toBeGreaterThan(0);
    instances[0].dispatchEvent(new Event('load'));
    await expect(pending).resolves.toBeDefined();
  });

  it('rejects a timed-out upload instead of leaving its promise pending forever', async () => {
    vi.stubGlobal('XMLHttpRequest', UploadXHR);
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' });
    const pending = uploadService.uploadToServerS3(file, {});
    const rejection = expect(pending).rejects.toBe(UPLOAD_NETWORK_ERROR);
    await vi.waitFor(() => expect(instances[0]?.send).toHaveBeenCalledWith(file));
    instances[0].dispatchEvent(new Event('timeout'));
    await rejection;
  });
});
