import type { InsertContextMessageParams } from '@lobechat/types';
import { nanoid } from '@lobechat/utils';
import { Flexbox } from '@lobehub/ui';
import { createModal, Select, Text, useModalContext } from '@lobehub/ui/base-ui';
import { t } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MessageContentEditor } from './index';

interface ContextMessageEditorProps {
  anchorId: string;
  draftKey: string;
  onSave: (params: Omit<InsertContextMessageParams, 'threadId'>) => Promise<void>;
}

const ContextMessageEditor = ({ anchorId, draftKey, onSave }: ContextMessageEditorProps) => {
  const { t } = useTranslation('chat');
  const { close } = useModalContext();
  const [id] = useState(() => nanoid());
  const [position, setPosition] = useState<'before' | 'after'>('after');
  return (
    <MessageContentEditor
      draftKey={draftKey}
      onCancel={close}
      onSave={(value) => onSave({ ...value, anchorId, id, position })}
    >
      <Flexbox gap={8}>
        <Text>{t('messageContent.contextDescription')}</Text>
        <Select
          aria-label={t('messageContent.position')}
          value={position}
          options={[
            { label: t('messageContent.after'), value: 'after' },
            { label: t('messageContent.before'), value: 'before' },
          ]}
          onChange={(value) => setPosition(value === 'before' ? 'before' : 'after')}
        />
      </Flexbox>
    </MessageContentEditor>
  );
};

export const openContextMessageEditor = (props: ContextMessageEditorProps) =>
  createModal({
    content: <ContextMessageEditor {...props} />,
    footer: null,
    maskClosable: false,
    title: t('messageContent.insertContext', { ns: 'chat' }),
    width: 'min(94vw, 920px)',
  });
