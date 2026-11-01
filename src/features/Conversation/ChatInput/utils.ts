import { AttachmentRetentionProcessor, getSlicedMessages } from '@lobechat/context-engine';
import type { ConversationFeatures, OpenAIChatMessage, UIChatMessage } from '@lobechat/types';

import type { PlaceholderVariant } from '@/features/ChatInput/InputEditor/Placeholder';

type SupportedChatInputRole = Extract<OpenAIChatMessage['role'], 'assistant' | 'tool' | 'user'>;

interface ChatInputMessage {
  content: string;
  role: SupportedChatInputRole;
}

const isSupportedChatInputMessage = (
  message: UIChatMessage,
): message is UIChatMessage & { role: SupportedChatInputRole } =>
  message.role === 'user' || message.role === 'assistant' || message.role === 'tool';

export const toChatInputMessages = (messages: UIChatMessage[]): ChatInputMessage[] =>
  messages.filter(isSupportedChatInputMessage).map((m) => ({
    content: typeof m.content === 'string' ? m.content : '',
    role: m.role,
  }));

export const getContextWindowMessages = (
  messages: UIChatMessage[],
  options: {
    conversationFeatures?: ConversationFeatures;
    enableHistoryCount?: boolean;
    historyCount?: number;
  },
) =>
  new AttachmentRetentionProcessor(options.conversationFeatures ?? {})
    .project(getSlicedMessages(messages, options))
    .map((message: UIChatMessage) =>
      message.role === 'compressedGroup'
        ? {
            ...message,
            role: 'user' as const,
            content: message.content
              ? `<compressed_history_summary>\n${message.content}\n</compressed_history_summary>`
              : '',
          }
        : message,
    )
    .filter(isSupportedChatInputMessage)
    .map((message) => ({
      audioList: message.audioList,
      chunksList: message.chunksList,
      content: typeof message.content === 'string' ? message.content : '',
      error: message.error,
      fileList: message.fileList,
      id: message.id,
      imageList: message.imageList,
      metadata: message.metadata,
      model: message.model,
      provider: message.provider,
      reasoning: message.reasoning,
      role: message.role,
      tools: message.tools,
      usage: message.usage,
      videoList: message.videoList,
    }));

export interface ConversationChatInputUiState {
  placeholderVariant: PlaceholderVariant;
  showSendMenu: boolean;
  showStopButton: boolean;
}

export interface GetConversationChatInputUiStateParams {
  /**
   * When true, the placeholder never flips to the followUp variant — used by
   * surfaces (e.g. onboarding) that have no follow-up / pending-message design.
   */
  disableFollowUpVariant?: boolean;
  isInputEmpty: boolean;
  isInputLoading: boolean;
}

export const getConversationChatInputUiState = ({
  disableFollowUpVariant,
  isInputEmpty,
  isInputLoading,
}: GetConversationChatInputUiStateParams): ConversationChatInputUiState => {
  // Keep the Stop button up for the entire loading window — including when the
  // user starts typing a follow-up. Previously this flipped to Send the moment
  // the composer had any text, which read as "agent finished" and made queued
  // sends look like fresh sends. Pressing Enter still enqueues; the QueueTray
  // exposes per-item Send-now and Edit/Delete for explicit control.
  const followUp = !disableFollowUpVariant && isInputLoading && isInputEmpty;
  return {
    placeholderVariant: followUp ? 'followUp' : 'default',
    showSendMenu: !isInputLoading,
    showStopButton: isInputLoading,
  };
};
