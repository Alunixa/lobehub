'use client';

import { ChatInput } from '@lobehub/editor/react';
import { Flexbox, Skeleton } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo } from 'react';

import ChatInputNotice from '@/features/ChatInput/ChatInputNotice';
import { useChatInputStore } from '@/features/ChatInput/store';
import { fileChatSelectors, useFileStore } from '@/store/file';

import ActionBar from '../ActionBar';
import ControlBar from '../ControlBar';
import type { DesktopChatInputProps } from '../Desktop';
import ContextContainer from '../Desktop/ContextContainer';
import InputEditor from '../InputEditor';
import SendArea from '../SendArea';
import TypoBar from '../TypoBar';

const styles = createStaticStyles(({ css }) => ({
  container: css`
    flex: none;
    min-width: 0;
    padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 0px));
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};
  `,
  editor: css`
    overflow-y: auto;
    max-height: min(240px, 32dvh);
    min-height: 46px;
    padding: 6px;
  `,
  toolbar: css`
    display: flex;
    gap: 4px;
    align-items: center;
    justify-content: space-between;
    min-width: 0;
    padding: 4px;
  `,
  controls: css`
    overflow-x: auto;
    min-width: 0;
    max-width: 100%;
  `,
}));

const MobileChatInput = memo<DesktopChatInputProps>(
  ({
    controlBarSlot,
    extraActionItems,
    hidden,
    isConfigLoading,
    leftContent,
    placeholder,
    placeholderVariant,
    sendAreaPrefix,
    showControlBar = true,
  }) => {
    const [slashMenuRef, showTypoBar] = useChatInputStore((s) => [s.slashMenuRef, s.showTypoBar]);
    const hasFiles = useFileStore(fileChatSelectors.chatUploadFileListHasItem);
    const hasContext = useFileStore(fileChatSelectors.chatContextSelectionHasItem);

    return (
      <Flexbox
        className={styles.container}
        gap={8}
        style={{ display: hidden ? 'none' : undefined }}
      >
        <ChatInputNotice />
        <ChatInput
          data-testid={'mobile-chat-input'}
          resize={false}
          slashMenuRef={slashMenuRef}
          footer={
            <div className={styles.toolbar}>
              <Flexbox style={{ flex: 1, minWidth: 0 }}>
                {isConfigLoading ? (
                  <Skeleton.Button active size={'small'} />
                ) : (
                  leftContent || <ActionBar extraActionItems={extraActionItems} />
                )}
              </Flexbox>
              <Flexbox horizontal align={'center'} flex={'none'} gap={4}>
                {sendAreaPrefix}
                <SendArea />
              </Flexbox>
            </div>
          }
          header={
            <Flexbox style={{ maxHeight: 144, overflowY: 'auto' }}>
              {showTypoBar && <TypoBar />}
              {(hasFiles || hasContext) && <ContextContainer />}
            </Flexbox>
          }
        >
          <div className={styles.editor}>
            <InputEditor
              defaultRows={2}
              placeholder={placeholder}
              placeholderVariant={placeholderVariant}
            />
          </div>
        </ChatInput>
        {(controlBarSlot || showControlBar) && (
          <div className={styles.controls}>{controlBarSlot ?? <ControlBar />}</div>
        )}
      </Flexbox>
    );
  },
);

MobileChatInput.displayName = 'MobileChatInput';

export default MobileChatInput;
