import type { OpenAIChatMessage, UserMessageContentPart } from '../../types';

/** Keep a retained tool exchange atomic, including after retries or window truncation. */
export const normalizeToolHistory = (messages: OpenAIChatMessage[]): OpenAIChatMessage[] => {
  const results = new Map<string, { index: number; message: OpenAIChatMessage }>();
  messages.forEach((message, index) => {
    if (message.role === 'tool' && message.tool_call_id) {
      results.set(message.tool_call_id, { index, message });
    }
  });
  const consumed = new Set<number>();
  const calls = new Set<string>();
  const output: OpenAIChatMessage[] = [];
  const followingUser: number[] = [];
  let nextUser = -1;
  for (let index = messages.length - 1; index >= 0; index--) {
    followingUser[index] = nextUser;
    if (messages[index].role === 'user') nextUser = index;
  }
  messages.forEach((message, index) => {
    if (message.role === 'tool') {
      if (!consumed.has(index) && message.content) {
        output.push({
          content: `[Historical tool output; original call is outside retained context]\n${
            typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
          }`,
          role: 'assistant',
        });
      }
      return;
    }
    if (message.role !== 'assistant' || !message.tool_calls?.length) {
      output.push(message);
      return;
    }
    const nextUser = followingUser[index];
    const paired = message.tool_calls.filter((call) => {
      const result = results.get(call.id);
      if (
        !call.id ||
        !call.function?.name ||
        typeof call.function.arguments !== 'string' ||
        calls.has(call.id) ||
        !result ||
        result.index <= index ||
        (nextUser >= 0 && result.index >= nextUser)
      )
        return false;
      calls.add(call.id);
      consumed.add(result.index);
      return true;
    });
    if (paired.length || message.content) {
      output.push({ ...message, tool_calls: paired.length ? paired : undefined });
    }
    paired.forEach((call) => output.push(results.get(call.id)!.message));
  });
  return output;
};

export const collectSystemMessages = (messages: readonly OpenAIChatMessage[]): string =>
  messages
    .filter((message) => message.role === 'system' || String(message.role) === 'developer')
    .map((message) =>
      typeof message.content === 'string'
        ? message.content
        : (message.content ?? [])
            .filter((part) => part.type === 'text')
            .map((part) => (part.type === 'text' ? part.text : ''))
            .join('\n'),
    )
    .filter((text) => text.trim())
    .join('\n\n');

export const isSystemMessage = (message: Pick<OpenAIChatMessage, 'role'>) =>
  message.role === 'system' || String(message.role) === 'developer';

/** OpenAI assistant history cannot contain image inputs; retain their provenance and pixels. */
export const relocateAssistantImages = (messages: OpenAIChatMessage[]): OpenAIChatMessage[] => {
  const output: OpenAIChatMessage[] = [];
  let pending: UserMessageContentPart[] = [];
  const flush = () => {
    if (!pending.length) return;
    output.push({
      content: [{ text: '[Images generated earlier by the assistant]', type: 'text' }, ...pending],
      role: 'user',
    });
    pending = [];
  };
  for (const message of messages) {
    if (message.role !== 'tool') flush();
    if (message.role === 'assistant' && Array.isArray(message.content)) {
      const media = message.content.filter((part) => part.type === 'image_url');
      pending = media;
      const content = message.content.filter((part) => part.type !== 'image_url');
      if (content.length || message.tool_calls?.length) output.push({ ...message, content });
    } else output.push(message);
  }
  flush();
  return output;
};
