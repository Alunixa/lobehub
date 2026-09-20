import { isRecord } from '@lobechat/utils/object';
import { type IEditor } from '@lobehub/editor';
import { ReactLinkPlugin, ReactTablePlugin } from '@lobehub/editor';
import { Editor } from '@lobehub/editor/react';
import { Flexbox } from '@lobehub/ui';
import { type FC, useMemo } from 'react';

import { createChatInputRichPlugins } from '@/features/ChatInput/InputEditor/plugins';
import { useIsMobile } from '@/hooks/useIsMobile';

import TypoBar from './Typobar';

interface EditorCanvasProps {
  compact?: boolean;
  defaultValue?: string;
  editor?: IEditor;
  editorData?: unknown;
  onChange?: () => void;
}

const EDITOR_PLUGINS = [
  ...createChatInputRichPlugins({ linkPlugin: ReactLinkPlugin }),
  ReactTablePlugin,
];

const EditorCanvas: FC<EditorCanvasProps> = ({
  defaultValue,
  editor,
  editorData,
  onChange,
  compact,
}) => {
  const mobile = useIsMobile();
  const { content, type } = useMemo(() => {
    const root = isRecord(editorData) && isRecord(editorData.root) ? editorData.root : undefined;
    const hasValidEditorData =
      isRecord(editorData) &&
      Object.keys(editorData).length > 0 &&
      !(Array.isArray(root?.children) && root.children.length === 0);

    if (hasValidEditorData) {
      return { content: JSON.stringify(editorData), type: 'json' as const };
    }

    // The markdown reader produces an empty root for an empty document, which
    // Lexical rejects. The text reader creates the editable empty paragraph.
    return {
      content: defaultValue || '',
      type: defaultValue?.trim() ? ('markdown' as const) : ('text' as const),
    };
  }, [editorData, defaultValue]);

  return (
    <>
      <TypoBar editor={editor} />
      <Flexbox
        padding={16}
        style={{
          cursor: 'text',
          maxHeight: compact ? '38dvh' : '80vh',
          minHeight: compact ? '20dvh' : '50vh',
          overflowY: 'auto',
        }}
      >
        <Editor
          autoFocus={!mobile}
          content={content}
          editor={editor}
          plugins={EDITOR_PLUGINS}
          type={type}
          variant={'chat'}
          style={{
            paddingBottom: compact ? 24 : 120,
          }}
          onChange={onChange}
        />
      </Flexbox>
    </>
  );
};

export default EditorCanvas;
