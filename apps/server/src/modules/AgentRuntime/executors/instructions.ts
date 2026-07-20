import { isResponsesAPIModel, type OpenAIChatMessage } from '@lobechat/model-runtime';
import { ModelProvider } from 'model-bank';

interface NativeInstructionsOptions {
  enabledSearch?: boolean;
  model: string;
  provider: string;
}

export const supportsNativeInstructions = ({
  enabledSearch,
  model,
  provider,
}: NativeInstructionsOptions): boolean => {
  switch (provider) {
    case ModelProvider.OpenAI:
    case ModelProvider.Azure: {
      return Boolean(enabledSearch) || isResponsesAPIModel(model);
    }

    case ModelProvider.GithubCopilot: {
      return isResponsesAPIModel(model) || model.toLowerCase().includes('oswe');
    }

    case ModelProvider.XAI: {
      return true;
    }

    case ModelProvider.Volcengine: {
      return Boolean(enabledSearch);
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
