import { LOADING_FLAT } from '@lobechat/const';
import type { UIChatMessage } from '@lobechat/types';

interface InferenceNode {
  children?: InferenceNode[];
  content?: string;
  error?: unknown;
  id: string;
  imageList?: unknown[];
  role?: string;
  tools?: unknown[] | null;
  videoList?: unknown[];
}
/**
 * UI snapshots include the current assistant placeholder. It is not a model
 * prefill: sending it makes the provider continue "..." instead of answering
 * the last user turn. Remove that target and failed placeholder rows only.
 * Real ellipsis replies, media, tool calls and user-authored context survive.
 */
export const prepareInferenceMessages = (
  messages: UIChatMessage[],
  targetAssistantId?: string,
): UIChatMessage[] => {
  const prepare = <T extends InferenceNode>(message: T): T | undefined => {
    if (targetAssistantId && message.id === targetAssistantId) return;
    if (
      (message.role === 'assistant' || message.role === undefined) &&
      message.error &&
      message.content === LOADING_FLAT &&
      !message.tools?.length &&
      !message.imageList?.length &&
      !message.videoList?.length
    )
      return;

    if (Array.isArray(message.children)) {
      const children = message.children
        .map((child) => prepare(child))
        .filter((child): child is InferenceNode => child !== undefined);
      if (message.children.length > 0 && children.length === 0) return;
      return { ...message, children } as T;
    }
    return message;
  };

  return messages.map(prepare).filter((message): message is UIChatMessage => message !== undefined);
};
