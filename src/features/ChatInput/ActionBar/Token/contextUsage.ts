import { LOADING_FLAT } from '@/const/message';
import type { ContextWindowMessage } from '@/features/ChatInput/store/initialState';

export const getRecordedContextUsage = (
  messages: ContextWindowMessage[] | undefined,
  model: string,
  provider: string,
) => {
  for (let index = (messages?.length ?? 0) - 1; index >= 0; index -= 1) {
    const message = messages![index];
    if (message.role !== 'assistant' || message.model !== model || message.provider !== provider)
      continue;
    const usage = message.usage ?? message.metadata?.usage ?? message.metadata;
    const inputTokens = usage?.totalInputTokens;
    if (typeof inputTokens !== 'number' || !Number.isFinite(inputTokens) || inputTokens <= 0)
      continue;
    const cachedTokens = usage?.inputCachedTokens ?? 0;
    return {
      cachedTokens: Number.isFinite(cachedTokens)
        ? Math.min(inputTokens, Math.max(0, cachedTokens))
        : 0,
      inputTokens,
    };
  }
};

export const getContextTextEstimateInput = (
  messages: ContextWindowMessage[] | undefined,
  preserveThinking: boolean,
) =>
  (messages ?? [])
    .map((message) => {
      const parts: string[] = [];
      if (message.content !== LOADING_FLAT || message.role === 'user') parts.push(message.content);
      for (const tool of message.tools ?? []) {
        parts.push(JSON.stringify({ arguments: tool.arguments, id: tool.id, name: tool.apiName }));
        if (tool.thoughtSignature) parts.push(tool.thoughtSignature);
      }
      if (preserveThinking && message.reasoning?.content) parts.push(message.reasoning.content);
      return parts.join('\n');
    })
    .join('\n\n');

export const getContextCapacity = (used: number, maximum: number) => ({
  maximum: Number.isFinite(maximum) ? Math.max(0, maximum) : 0,
  remaining: Number.isFinite(maximum) && Number.isFinite(used) ? Math.max(0, maximum - used) : 0,
  used: Number.isFinite(used) ? Math.max(0, used) : 0,
});
