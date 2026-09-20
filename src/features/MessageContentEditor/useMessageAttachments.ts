import { nanoid } from '@lobechat/utils';
import { useEffect, useRef, useState } from 'react';

import { ragService } from '@/services/rag';
import { useFileStore } from '@/store/file';
import { isChunkingUnsupported } from '@/utils/isChunkingUnsupported';

import type { MessageAttachment } from './attachments';

interface PendingAttachment {
  error?: boolean;
  file: File;
  id: string;
  progress: number;
}

/** Independent upload queue: never touches the main chat composer's draft files. */
export const useMessageAttachments = (initial: MessageAttachment[]) => {
  const [attachments, setAttachments] = useState(initial);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const controller of controllers.current.values()) controller.abort();
      controllers.current.clear();
    };
  }, []);

  const upload = async (item: PendingAttachment) => {
    const controller = new AbortController();
    controllers.current.set(item.id, controller);
    setPending((list) =>
      list.map((entry) => (entry.id === item.id ? { ...entry, error: false } : entry)),
    );
    try {
      const uploaded = await useFileStore.getState().uploadWithProgress({
        abortController: controller,
        file: item.file,
        uploadId: item.id,
        onStatusUpdate: (event) => {
          if (!mounted.current || controller.signal.aborted || event.type !== 'updateFile') return;
          setPending((list) =>
            list.map((entry) =>
              entry.id === item.id
                ? { ...entry, progress: event.value.uploadState?.progress ?? entry.progress }
                : entry,
            ),
          );
        },
      });
      if (!uploaded) throw new Error('Attachment upload did not complete');
      if (!isChunkingUnsupported(item.file.type)) await ragService.parseFileContent(uploaded.id);
      if (!mounted.current || controller.signal.aborted) return;
      setAttachments((list) => [
        ...list.filter((entry) => entry.id !== uploaded.id),
        { id: uploaded.id, name: uploaded.filename ?? item.file.name, url: uploaded.url },
      ]);
      setPending((list) => list.filter((entry) => entry.id !== item.id));
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return;
      console.error('Message attachment upload failed:', error);
      setPending((list) =>
        list.map((entry) => (entry.id === item.id ? { ...entry, error: true } : entry)),
      );
    } finally {
      controllers.current.delete(item.id);
    }
  };

  return {
    addFiles: async (files: File[]) => {
      const items = files.map((file) => ({ file, id: nanoid(), progress: 0 }));
      setPending((list) => [...list, ...items]);
      await Promise.all(items.map(upload));
    },
    attachments,
    pending,
    remove: (id: string) => {
      controllers.current.get(id)?.abort();
      setAttachments((list) => list.filter((entry) => entry.id !== id));
      setPending((list) => list.filter((entry) => entry.id !== id));
    },
    retry: upload,
  };
};
