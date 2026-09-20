import { useTranslation } from 'react-i18next';

import ImperativeModal from '@/components/ImperativeModal';
import { dataSelectors, useConversationStore } from '@/features/Conversation/store';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import { getMessageAttachments } from './attachments';
import { MessageContentEditor } from './index';

export const UserMessageEditor = ({ id }: { id: string }) => {
  const { t } = useTranslation(['chat', 'common']);
  const userId = useUserStore(userProfileSelectors.userId);
  const item = useConversationStore(dataSelectors.getDbMessageById(id));
  const [save, toggle] = useConversationStore((s) => [
    s.saveMessageContent,
    s.toggleMessageEditing,
  ]);
  const close = () => toggle(id, false);
  if (!item) return null;
  return (
    <ImperativeModal
      open
      footer={null}
      maskClosable={false}
      title={t('messageContent.editTitle')}
      width={'min(94vw, 920px)'}
      onCancel={close}
    >
      <MessageContentEditor
        attachments={getMessageAttachments(item)}
        draftKey={`lobehub:message-edit:${userId}:${id}`}
        editorData={item.editorData}
        value={item.content}
        onCancel={close}
        onSave={(value) => save({ ...value, id })}
      />
    </ImperativeModal>
  );
};
