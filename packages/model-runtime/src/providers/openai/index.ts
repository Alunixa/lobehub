import { ModelProvider } from 'model-bank';

import { pruneReasoningPayload } from '../../core/contextBuilders/openai';
import type { OpenAICompatibleFactoryOptions } from '../../core/openaiCompatibleFactory';
import { createOpenAICompatibleRuntime } from '../../core/openaiCompatibleFactory';
import type { ChatStreamPayload } from '../../types';
import { processMultiProviderModelList } from '../../utils/modelParse';
import {
  isGPT5ProResponsesModel,
  isOpenAIComputerUseModel,
  isOpenAIReasoningPayloadModel,
  isResponsesAPIModel,
  supportsOpenAIServiceTierFlex,
} from './openaiModelId';

export interface OpenAIModelCard {
  id: string;
}

const oaiSearchContextSize = process.env.OPENAI_SEARCH_CONTEXT_SIZE; // low, medium, high
const enableServiceTierFlex = process.env.OPENAI_SERVICE_TIER_FLEX === '1';

export const params = {
  baseURL: 'https://api.openai.com/v1',
  chatCompletion: {
    handlePayload: (payload) => {
      const { enabledSearch, instructions, model, ...rest } = payload;

      if (isResponsesAPIModel(model) || enabledSearch) {
        return {
          ...rest,
          apiMode: 'responses',
          enabledSearch,
          instructions,
          model,
        } as ChatStreamPayload;
      }

      const chatPayload = {
        ...rest,
        messages: instructions
          ? [{ content: instructions, role: 'system' as const }, ...rest.messages]
          : rest.messages,
      };

      if (isOpenAIReasoningPayloadModel(model)) {
        return pruneReasoningPayload({ ...chatPayload, model }) as any;
      }

      if (model.includes('-search-')) {
        return {
          ...chatPayload,
          frequency_penalty: undefined,
          model,
          presence_penalty: undefined,
          stream: payload.stream ?? true,
          temperature: undefined,
          top_p: undefined,
          ...(enableServiceTierFlex &&
            supportsOpenAIServiceTierFlex(model) && { service_tier: 'flex' }),
          ...(oaiSearchContextSize && {
            web_search_options: {
              search_context_size: oaiSearchContextSize,
            },
          }),
        } as any;
      }

      return {
        ...chatPayload,
        model,
        ...(enableServiceTierFlex &&
          supportsOpenAIServiceTierFlex(model) && { service_tier: 'flex' }),
        stream: payload.stream ?? true,
      };
    },
  },
  debug: {
    chatCompletion: () => process.env.DEBUG_OPENAI_CHAT_COMPLETION === '1',
    responses: () => process.env.DEBUG_OPENAI_RESPONSES === '1',
  },
  models: async ({ client }) => {
    const modelsPage = (await client.models.list()) as any;
    const modelList: OpenAIModelCard[] = modelsPage.data;

    // Automatically detect model provider and select corresponding configuration
    return processMultiProviderModelList(modelList, 'openai');
  },
  provider: ModelProvider.OpenAI,
  responses: {
    handlePayload: (payload) => {
      const { enabledSearch, model, tools, verbosity, ...rest } = payload;

      const openaiTools = enabledSearch
        ? [
            ...(tools || []),
            {
              type: 'web_search',
              ...(oaiSearchContextSize && {
                search_context_size: oaiSearchContextSize,
              }),
            },
          ]
        : tools;

      if (isOpenAIReasoningPayloadModel(model)) {
        const reasoning = payload.reasoning
          ? { ...payload.reasoning, summary: 'auto' }
          : { summary: 'auto' };
        if (isGPT5ProResponsesModel(model)) {
          reasoning.effort = 'high';
        }
        return pruneReasoningPayload({
          ...rest,
          model,
          reasoning,
          ...(enableServiceTierFlex &&
            supportsOpenAIServiceTierFlex(model) && { service_tier: 'flex' }),
          stream: payload.stream ?? true,
          tools: openaiTools as any,
          // computer-use series must set truncation as auto
          ...(isOpenAIComputerUseModel(model) && { truncation: 'auto' }),
          text: verbosity ? { verbosity } : undefined,
        }) as any;
      }

      return {
        ...rest,
        model,
        ...(enableServiceTierFlex &&
          supportsOpenAIServiceTierFlex(model) && { service_tier: 'flex' }),
        stream: payload.stream ?? true,
        tools: openaiTools,
      } as any;
    },
  },
} satisfies OpenAICompatibleFactoryOptions;

export const LobeOpenAI = createOpenAICompatibleRuntime(params);
