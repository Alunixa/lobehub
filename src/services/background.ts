import type { BackgroundImage } from '@lobechat/types';
import { sha256 } from 'js-sha256';

import { fileService } from './file';
import { uploadService } from './upload';

class BackgroundService {
  uploadImage = async (file: File, controller: AbortController): Promise<BackgroundImage> => {
    if (controller.signal.aborted) throw new DOMException('Upload cancelled', 'AbortError');
    const { data } = await uploadService.uploadFileToS3(file, {
      abortController: controller,
      directory: 'backgrounds',
    });
    if (controller.signal.aborted) throw new DOMException('Upload cancelled', 'AbortError');
    const result = await fileService.createFile({
      fileType: file.type,
      hash: sha256(await file.arrayBuffer()),
      metadata: data,
      name: file.name,
      size: file.size,
      source: 'global-background',
      url: data.path,
      visibility: 'private',
    });
    return { id: result.id, name: file.name, url: `/f/${result.id}` };
  };
}

export const backgroundService = new BackgroundService();
