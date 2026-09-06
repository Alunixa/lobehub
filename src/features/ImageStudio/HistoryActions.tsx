'use client';

import { ActionIcon } from '@lobehub/ui';
import { confirmModal, DropdownMenu } from '@lobehub/ui/base-ui';
import { App } from 'antd';
import { EyeOff, MoreHorizontal, Trash2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useActiveWorkspaceId } from '@/business/client/hooks/useActiveWorkspaceId';
import VisibilityConfirmContent from '@/features/VisibilityConfirmContent';
import { useImageStore } from '@/store/image';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';
import type { ImageGenerationTopic } from '@/types/generation';

export const StudioHistoryActions = ({
  disabled,
  topic,
}: {
  disabled: boolean;
  topic: ImageGenerationTopic;
}) => {
  const { t } = useTranslation(['image', 'common', 'chat']);
  const { message } = App.useApp();
  const workspaceId = useActiveWorkspaceId();
  const userId = useUserStore(userProfileSelectors.userId);
  const removeTopic = useImageStore((s) => s.removeGenerationTopic);
  const setVisibility = useImageStore((s) => s.setGenerationTopicVisibility);
  const isOwner = !workspaceId || Boolean(userId && topic.creator?.id === userId);
  const isPublic = topic.visibility === 'public';
  if (!isOwner) return null;

  return (
    <DropdownMenu
      placement={'bottomRight'}
      items={[
        ...(workspaceId
          ? [
              {
                icon: isPublic ? EyeOff : Users,
                key: 'visibility',
                label: isPublic
                  ? t('makePrivate', { ns: 'common' })
                  : t('resources.publishToWorkspace.menu', { ns: 'chat' }),
                onClick: () => {
                  confirmModal({
                    cancelText: t('cancel', { ns: 'common' }),
                    content: (
                      <VisibilityConfirmContent variant={isPublic ? 'makePrivate' : 'publish'} />
                    ),
                    okText: t('continue', { ns: 'common' }),
                    title: isPublic
                      ? t('makePrivate.confirm.title', { ns: 'common' })
                      : t('resources.publishToWorkspace.menu', { ns: 'chat' }),
                    onOk: async () => {
                      try {
                        await setVisibility(topic.id, isPublic ? 'private' : 'public');
                      } catch (error) {
                        console.error('Failed to update image topic visibility:', error);
                        message.error(
                          isPublic
                            ? t('makePrivate.error', { ns: 'common' })
                            : t('resources.publishToWorkspace.error', { ns: 'chat' }),
                        );
                        throw error;
                      }
                    },
                  });
                },
              },
            ]
          : []),
        {
          danger: true,
          icon: Trash2,
          key: 'delete',
          label: t('delete', { ns: 'common' }),
          onClick: () => {
            confirmModal({
              cancelText: t('cancel', { ns: 'common' }),
              content: t('topic.deleteConfirmDesc'),
              okButtonProps: { danger: true },
              okText: t('delete', { ns: 'common' }),
              title: t('topic.deleteConfirm'),
              onOk: async () => {
                try {
                  await removeTopic(topic.id);
                } catch (error) {
                  console.error('Failed to delete image history:', error);
                  message.error(t('studio.deleteFailed'));
                  throw error;
                }
              },
            });
          },
        },
      ]}
    >
      <ActionIcon
        aria-label={t('more', { ns: 'common' })}
        disabled={disabled}
        icon={MoreHorizontal}
        size={{ blockSize: 44, size: 18 }}
        onClick={(event) => event.stopPropagation()}
      />
    </DropdownMenu>
  );
};
