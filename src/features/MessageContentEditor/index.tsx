import type { EditMessageContentParams } from '@lobechat/types';
import { isRecord } from '@lobechat/utils/object';
import { useEditor } from '@lobehub/editor/react';
import { Flexbox } from '@lobehub/ui';
import { Alert, Button, Text } from '@lobehub/ui/base-ui';
import { Paperclip } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import EditorCanvas from '@/features/EditorModal/EditorCanvas';

import type { MessageAttachment } from './attachments';
import { useContentDraft, usePersistContentDraft } from './useContentDraft';
import { useMessageAttachments } from './useMessageAttachments';

export interface MessageContentEditorProps {
  attachments?: MessageAttachment[];
  children?: ReactNode;
  draftKey: string;
  editorData?: unknown;
  onCancel: () => void;
  onSave: (value: Omit<EditMessageContentParams, 'id'>) => Promise<void>;
  value?: string;
}

export const MessageContentEditor = ({
  attachments: initialAttachments = [], children, draftKey, editorData: initialEditorData,
  onCancel, onSave, value = '',
}: MessageContentEditorProps) => {
  const { t } = useTranslation(['chat', 'common']);
  const editor = useEditor();
  const input = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const draft = useContentDraft(draftKey, {
    attachments: initialAttachments,
    content: value,
    editorData: isRecord(initialEditorData) ? initialEditorData : undefined,
  });
  const uploads = useMessageAttachments(draft.initial.attachments);
  usePersistContentDraft(draftKey, {
    attachments: uploads.attachments, content: draft.content, editorData: draft.editorData,
  }, draft.setStorageError);

  const save = async () => {
    if (savingRef.current || uploads.pending.length) return;
    const content = String(editor?.getDocument('markdown') ?? draft.content);
    if (!content.trim() && !uploads.attachments.length) return;
    savingRef.current = true;
    setSaving(true);
    setError(false);
    try {
      const json = editor?.getDocument('json');
      await onSave({
        content,
        editorData: isRecord(json) ? json : null,
        fileIds: uploads.attachments.map((item) => item.id),
      });
      draft.clear();
      onCancel();
    } catch (cause) {
      console.error('Message content save failed:', cause);
      setError(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Flexbox gap={12} style={{ maxHeight: '78dvh', minWidth: 0 }}>
      {children}
      <Flexbox
        style={{ overflowY: 'auto' }}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) event.preventDefault();
        }}
        onDrop={(event) => {
          if (!event.dataTransfer.files.length || saving) return;
          event.preventDefault();
          void uploads.addFiles(Array.from(event.dataTransfer.files));
        }}
        onPasteCapture={(event) => {
          if (!event.clipboardData.files.length || saving) return;
          event.preventDefault();
          void uploads.addFiles(Array.from(event.clipboardData.files));
        }}
      >
        <EditorCanvas
          compact
          defaultValue={draft.initial.content}
          editor={editor}
          editorData={draft.initial.editorData}
          onChange={() => {
            draft.setContent(String(editor?.getDocument('markdown') ?? ''));
            const json = editor?.getDocument('json');
            if (isRecord(json)) draft.setEditorData(json);
          }}
        />
        <Flexbox gap={8} paddingInline={16}>
          {uploads.attachments.map((item) => (
            <Flexbox horizontal align={'center'} gap={8} key={item.id}>
              <Text style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{item.name}</Text>
              <Button disabled={saving} size={'small'} onClick={() => uploads.remove(item.id)}>
                {t('common:remove')}
              </Button>
            </Flexbox>
          ))}
          {uploads.pending.map((item) => (
            <Flexbox horizontal align={'center'} gap={8} key={item.id} wrap={'wrap'}>
              <Text style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                {item.file.name} · {item.error ? t('messageContent.uploadFailed') : `${Math.round(item.progress)}%`}
              </Text>
              {item.error && <Button size={'small'} onClick={() => void uploads.retry(item)}>
                {t('common:retry')}
              </Button>}
              <Button size={'small'} onClick={() => uploads.remove(item.id)}>
                {t('common:remove')}
              </Button>
            </Flexbox>
          ))}
        </Flexbox>
      </Flexbox>
      {error && <Alert title={t('messageContent.saveFailed')} type={'error'} />}
      {draft.storageError && <Alert title={t('messageContent.draftFailed')} type={'warning'} />}
      <Flexbox horizontal gap={8} justify={'space-between'} padding={8} wrap={'wrap'}>
        <input
          multiple
          aria-label={t('messageContent.addAttachments')}
          ref={input}
          style={{ display: 'none' }}
          type={'file'}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            void uploads.addFiles(files);
          }}
        />
        <Button disabled={saving} icon={Paperclip} onClick={() => input.current?.click()}>
          {t('messageContent.addAttachments')}
        </Button>
        <Flexbox horizontal gap={8}>
          <Button disabled={saving} onClick={onCancel}>{t('common:cancel')}</Button>
          <Button
            disabled={!!uploads.pending.length || (!draft.content.trim() && !uploads.attachments.length)}
            loading={saving}
            type={'primary'}
            onClick={() => void save()}
          >
            {t('common:save')}
          </Button>
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
};
