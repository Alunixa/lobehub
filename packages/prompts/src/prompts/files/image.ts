import { createVisualFileRef } from '@lobechat/const/visualRef';
import type { ChatImageItem } from '@lobechat/types';

import { escapeXmlAttr } from '../search/xmlEscape';

const imagePrompt = (
  item: ChatImageItem,
  attachUrl: boolean,
  index: number,
  messageId?: string,
) => {
  const ref = createVisualFileRef({ index, messageId, type: 'image' });
  const fileId = item.id ? ` fileId="${escapeXmlAttr(item.id)}"` : '';
  const attributes = `ref="${ref}"${fileId} name="${escapeXmlAttr(item.alt)}"`;

  return attachUrl
    ? `<image ${attributes} url="${escapeXmlAttr(item.url)}"></image>`
    : `<image ${attributes}></image>`;
};

export const imagesPrompts = (
  imageList: ChatImageItem[],
  attachUrl: boolean,
  messageId?: string,
) => {
  if (imageList.length === 0) return '';

  const prompt = `<images>
<images_docstring>here are user upload images you can refer to</images_docstring>
${imageList.map((item, index) => imagePrompt(item, attachUrl, index, messageId)).join('\n')}
</images>`;

  return prompt.trim();
};
