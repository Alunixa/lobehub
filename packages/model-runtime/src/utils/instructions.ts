import { ModelProvider } from 'model-bank';

import { isResponsesAPIModel } from '../providers/openai/openaiModelId';
import type { OpenAIChatMessage } from '../types';

interface NativeInstructionsOptions {
  apiMode?: 'chatCompletion' | 'responses';
  enabledSearch?: boolean;
  model: string;
  provider?: string;
}

export interface RoutedInstructions {
  instructions?: string;
  messages: OpenAIChatMessage[];
}

export const supportsNativeInstructions = ({
  apiMode,
  enabledSearch,
  model,
  provider,
}: NativeInstructionsOptions): boolean => {
  switch (provider) {
    case ModelProvider.OpenAI:
    case ModelProvider.Azure: {
      return apiMode === 'responses' || Boolean(enabledSearch) || isResponsesAPIModel(model);
    }

    case ModelProvider.GithubCopilot: {
      return (
        apiMode === 'responses' ||
        isResponsesAPIModel(model) ||
        model.toLowerCase().includes('oswe')
      );
    }

    case ModelProvider.XAI: {
      return true;
    }

    case ModelProvider.Volcengine: {
      return apiMode === 'responses' || Boolean(enabledSearch);
    }

    default: {
      return false;
    }
  }
};

export const mergeInstructionsIntoSystemMessage = (
  messages: OpenAIChatMessage[],
  instructions?: string | null,
): OpenAIChatMessage[] => {
  const normalizedInstructions = instructions?.trim();
  if (!normalizedInstructions) return messages;

  const systemMessageIndex = messages.findIndex((message) => message.role === 'system');
  if (systemMessageIndex < 0) {
    return [{ content: normalizedInstructions, role: 'system' }, ...messages];
  }

  const systemMessage = messages[systemMessageIndex];
  if (typeof systemMessage.content !== 'string') {
    return [{ content: normalizedInstructions, role: 'system' }, ...messages];
  }

  const normalizedSystemRole = systemMessage.content.trim();
  const nextSystemMessage: OpenAIChatMessage = {
    ...systemMessage,
    content: normalizedSystemRole
      ? `${normalizedInstructions}\n\n${normalizedSystemRole}`
      : normalizedInstructions,
  };

  return messages.map((message, index) =>
    index === systemMessageIndex ? nextSystemMessage : message,
  );
};

export const routeInstructions = ({
  apiMode,
  enabledSearch,
  instructions,
  messages,
  model,
  provider,
}: NativeInstructionsOptions & {
  instructions?: string | null;
  messages: OpenAIChatMessage[];
}): RoutedInstructions => {
  const normalizedInstructions = instructions?.trim();
  if (!normalizedInstructions) return { messages };

  if (
    supportsNativeInstructions({
      apiMode,
      enabledSearch,
      model,
      provider,
    })
  ) {
    return { instructions: normalizedInstructions, messages };
  }

  return {
    messages: mergeInstructionsIntoSystemMessage(messages, normalizedInstructions),
  };
};
