import {
  generatedImageFilePath,
  isConversationImageGeneration,
} from '@lobechat/utils/conversationImageResult';
import { toRecord } from '@lobechat/utils/object';

import { BaseProcessor } from '../base/BaseProcessor';
import type { Message, PipelineContext } from '../types';

const MAX_CONTEXT_IMAGES = 8;

/** Keep tool results textual; add vision input only after the entire tool-result block. */
export class ConversationImageFeedback extends BaseProcessor {
  readonly name = 'ConversationImageFeedback';

  constructor(private readonly vision: () => boolean) {
    super();
  }

  protected async doProcess(context: PipelineContext) {
    const additions = new Map<number, string[]>();
    const seen = new Set<string>();
    let remaining = MAX_CONTEXT_IMAGES;
    for (let i = context.messages.length - 1; i >= 0 && remaining > 0; i--) {
      const message = context.messages[i];
      if (
        (message.role !== 'tool' && message.role !== 'user') ||
        !isConversationImageGeneration(message.plugin)
      )
        continue;

      const images = toRecord(message.pluginState)?.images;
      if (!Array.isArray(images)) continue;
      let position = i;
      while (context.messages[position + 1]?.role === 'tool') position++;
      const paths: string[] = [];
      for (const image of images) {
        const id = toRecord(image)?.fileId;
        if (typeof id !== 'string' || seen.has(id)) continue;
        const path = `/f/${id}`;
        if (!generatedImageFilePath.test(path)) continue;
        seen.add(id);
        paths.push(path);
        if (--remaining === 0) break;
      }
      if (paths.length) additions.set(position, [...paths, ...(additions.get(position) ?? [])]);
    }
    if (!additions.size) return context;

    const canSee = this.vision();
    const messages: Message[] = [];
    for (const [index, message] of context.messages.entries()) {
      messages.push(message);
      const paths = additions.get(index);
      if (!paths) continue;
      const followUp = context.messages.slice(index + 1).every((item) => item.role === 'system');
      const label = (path: string) => `Generated image file ID: ${path.slice(3)}.`;
      const text = followUp
        ? 'Review the generated images actually attached here against the user request and reference images before replying. Briefly report any visible mismatch and distinguish verified facts from guesses. Do not generate another image automatically.'
        : 'Previously generated image context. Use these images and their file IDs for follow-up requests.';
      messages.push({
        content: canSee
          ? [
              { text, type: 'text' },
              ...paths.flatMap((path) => [
                { text: label(path), type: 'text' },
                { image_url: { detail: 'auto', url: path }, type: 'image_url' },
              ]),
              {
                text: 'Only inspect images actually present in this message; unshown or unavailable images were not visually reviewed.',
                type: 'text',
              },
            ]
          : `${paths.map(label).join(' ')} The current model has no vision input. Use the recorded generation details, and do not claim visual review.`,
        role: 'user',
      });
    }
    return { ...context, messages };
  }
}
