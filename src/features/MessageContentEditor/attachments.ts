import type { UIChatMessage } from '@lobechat/types';

export interface MessageAttachment {
  id: string;
  name: string;
  url: string;
}

export const getMessageAttachments = (message?: UIChatMessage): MessageAttachment[] => {
  if (!message) return [];
  const attachments = [
    ...(message.fileList ?? []).map(({ id, name, url }) => ({ id, name, url })),
    ...[
      ...(message.imageList ?? []),
      ...(message.videoList ?? []),
      ...(message.audioList ?? []),
    ].map(({ id, alt, url }) => ({ id, name: alt || id, url })),
  ];
  return [...new Map(attachments.map((attachment) => [attachment.id, attachment])).values()];
};
