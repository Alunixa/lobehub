import { isRecord } from '@lobechat/utils/object';
import { useEffect, useState } from 'react';

import type { MessageAttachment } from './attachments';

export interface MessageContentDraft {
  attachments: MessageAttachment[];
  content: string;
  editorData?: Record<string, unknown> | null;
}

const loadDraft = (key: string, fallback: MessageContentDraft): MessageContentDraft => {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!isRecord(raw) || typeof raw.content !== 'string' || !Array.isArray(raw.attachments))
      return fallback;
    const attachments = raw.attachments.filter(
      (item): item is MessageAttachment =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.url === 'string',
    );
    return {
      attachments,
      content: raw.content,
      editorData: isRecord(raw.editorData) ? raw.editorData : undefined,
    };
  } catch (error) {
    console.error('Failed to restore message content draft:', error);
    return fallback;
  }
};

export const useContentDraft = (key: string, fallback: MessageContentDraft) => {
  const [initial] = useState(() => loadDraft(key, fallback));
  const [content, setContent] = useState(initial.content);
  const [editorData, setEditorData] = useState(initial.editorData);
  const [storageError, setStorageError] = useState(false);
  return {
    clear: () => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error('Failed to clear message content draft:', error);
      }
    },
    content,
    editorData,
    initial,
    setContent,
    setEditorData,
    setStorageError,
    storageError,
  };
};

export const usePersistContentDraft = (
  key: string,
  draft: MessageContentDraft,
  onError: (error: boolean) => void,
) => {
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(draft));
      onError(false);
    } catch (error) {
      console.error('Failed to persist message content draft:', error);
      onError(true);
    }
  }, [key, draft.content, draft.editorData, draft.attachments, onError]);
};
