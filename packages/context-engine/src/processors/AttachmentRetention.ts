import type { ConversationFeatures } from '@lobechat/types';
import { DEFAULT_ATTACHMENT_RETENTION_COUNT } from '@lobechat/types';
import { getMimeType } from '@lobechat/utils/mimeType';
import { pickString, toRecord } from '@lobechat/utils/object';
import { safeParseJSON } from '@lobechat/utils/safeParseJSON';

import { BaseProcessor } from '../base/BaseProcessor';
import type { Message, PipelineContext } from '../types';

type AttachmentKind = 'file' | 'image';
type AttachmentField = 'audioList' | 'fileList' | 'imageList' | 'videoList';

const FIELDS: AttachmentField[] = ['imageList', 'fileList', 'videoList', 'audioList'];
const getCount = (enabled: boolean | undefined, count: number | undefined) =>
  enabled
    ? Number.isSafeInteger(count) && count! >= 0
      ? count!
      : DEFAULT_ATTACHMENT_RETENTION_COUNT
    : Infinity;

const fileKind = (value: unknown): AttachmentKind => {
  const file = toRecord(value);
  const type = pickString(file?.fileType) ?? pickString(file?.mimeType) ?? '';
  const inferredType = getMimeType(pickString(file?.name) ?? pickString(file?.filename) ?? '');
  return (type && type !== 'application/octet-stream' ? type : inferredType).startsWith('image/')
    ? 'image'
    : 'file';
};

const partKind = (value: unknown): AttachmentKind | undefined => {
  const part = toRecord(value);
  switch (part?.type) {
    case 'image':
    case 'image_url':
    case 'input_image': {
      return 'image';
    }
    case 'file':
    case 'file_url':
    case 'input_file': {
      return fileKind(toRecord(part.file) ?? part);
    }
    case 'audio_url':
    case 'input_audio':
    case 'video_url': {
      return 'file';
    }
    default: {
      return undefined;
    }
  }
};

/** Request-only projection after flattening, before file text and media encoding. */
export class AttachmentRetentionProcessor extends BaseProcessor {
  readonly name = 'AttachmentRetentionProcessor';

  constructor(
    private readonly features: ConversationFeatures,
    private readonly contentOnly = false,
  ) {
    super();
  }

  protected async doProcess(context: PipelineContext): Promise<PipelineContext> {
    const remaining = {
      file: getCount(this.features.limitFiles, this.features.fileRetentionCount),
      image: getCount(this.features.limitImages, this.features.imageRetentionCount),
    };
    if (remaining.file === Infinity && remaining.image === Infinity) return context;
    const result = this.cloneContext(context);
    for (let index = result.messages.length - 1; index >= 0; index--) {
      const message: Message = { ...result.messages[index] };
      const retainedFileIds = new Set<string>();
      const removedFileIds = new Set<string>();
      let omitted = false;
      const keep = (value: unknown, kind: AttachmentKind) => {
        const retained = remaining[kind] > 0;
        if (retained) remaining[kind]--;
        else omitted = true;
        const id = pickString(toRecord(value)?.id);
        if (id) (retained ? retainedFileIds : removedFileIds).add(id);
        return retained;
      };
      const filter = (items: unknown[], kind: (value: unknown) => AttachmentKind | undefined) => {
        const accepted = new Set<number>();
        for (let i = items.length - 1; i >= 0; i--) {
          const itemKind = kind(items[i]);
          if (!itemKind || keep(items[i], itemKind)) accepted.add(i);
        }
        return items.filter((_, i) => accepted.has(i));
      };
      const serialized =
        toRecord(message.metadata)?.isMultimodal === true && typeof message.content === 'string';
      const parts: unknown = serialized
        ? safeParseJSON<unknown>(pickString(message.content))
        : message.content;
      if (Array.isArray(parts)) {
        const retained = filter(parts, partKind);
        message.content = serialized ? JSON.stringify(retained) : retained;
      }
      for (const field of this.contentOnly ? [] : [...FIELDS].reverse()) {
        const items: unknown = message[field];
        if (!Array.isArray(items)) continue;
        message[field] = filter(items, (item) =>
          field === 'imageList' ? 'image' : field === 'fileList' ? fileKind(item) : 'file',
        );
      }
      if (Array.isArray(message.chunksList) && removedFileIds.size > 0) {
        message.chunksList = message.chunksList.filter((chunk: unknown) => {
          const id = pickString(toRecord(chunk)?.fileId);
          return !id || !removedFileIds.has(id) || retainedFileIds.has(id);
        });
      }
      if (
        omitted &&
        message.role === 'user' &&
        (message.content === '' ||
          (Array.isArray(message.content) && message.content.length === 0)) &&
        FIELDS.every((field) => !Array.isArray(message[field]) || message[field].length === 0)
      ) {
        message.content = '[Attachments omitted by request retention settings.]';
      }
      result.messages[index] = message;
    }
    return result;
  }
}
