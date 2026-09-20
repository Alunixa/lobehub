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
    const hasValidEditorData =
      editorData && typeof editorData === 'object' && Object.keys(editorData).length > 0;

    if (hasValidEditorData) {
      return { content: JSON.stringify(editorData), type: 'json' as const };
    }

    return { content: defaultValue || '', type: 'markdown' as const };
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
