'use client';

import { useChatStore } from '@/store/chat';

import { useChatInputStore } from '../store';

/** An embedded composer's explicit null must not inherit the outer conversation. */
export const useTopicId = (): string | null => {
  const context = useChatInputStore((s) => s.conversationContext);
  const activeTopicId = useChatStore((s) => s.activeTopicId);
  return context ? (context.topicId ?? null) : (activeTopicId ?? null);
};
