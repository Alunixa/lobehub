import { imageUrlToBase64, videoUrlToBase64 } from '@lobechat/utils';
import { toRecord } from '@lobechat/utils/object';
import { Buffer } from 'buffer.js';
import type OpenAI from 'openai';
import { toFile } from 'openai';

import { disableStreamModels, systemToUserModels } from '../../providers/openai/openaiModelId';
import type { ChatStreamPayload, OpenAIChatMessage, UserMessageContentPart } from '../../types';
import { isDeepSeekThinkingEligibleModel } from '../../utils/modelParse';
import { parseDataUri } from '../../utils/uriParser';
import { isModelHostedMedia } from './modelHostedMedia';
import { normalizeToolHistory, relocateAssistantImages } from './protocolMessages';

export type ExtendedChatCompletionContentPart = {
  type: 'video_url';
  video_url: {
    url: string;
  };
};

type ConvertMessageContentOptions = {
  allowReasoning?: boolean;
  allowVideo?: boolean;
  forceImageBase64?: boolean;
  forceVideoBase64?: boolean;
  model?: string;
  strictToolPairing?: boolean;
};

const isDeepSeekModel = (model: string | undefined) =>
  typeof model === 'string' && model.toLowerCase().includes('deepseek');

type OpenAICompatibleContentPart =
  ExtendedChatCompletionContentPart | OpenAI.ChatCompletionContentPart | UserMessageContentPart;

const isInternalThinkingContentPart = (
  content: OpenAICompatibleContentPart,
): content is Extract<UserMessageContentPart, { type: 'thinking' }> => content.type === 'thinking';

export const convertMessageContent = async (
  content: OpenAI.ChatCompletionContentPart | ExtendedChatCompletionContentPart,
  options?: ConvertMessageContentOptions,
): Promise<OpenAI.ChatCompletionContentPart | ExtendedChatCompletionContentPart> => {
  if (content.type === 'image_url') {
    const { type } = parseDataUri(content.image_url.url);

    const shouldUseBase64 =
      options?.forceImageBase64 ||
      (process.env.LLM_VISION_IMAGE_USE_BASE64 === '1' && !isModelHostedMedia(content.image_url));

    if (type === 'url' && shouldUseBase64) {
      const { base64, mimeType } = await imageUrlToBase64(content.image_url.url);

      return {
        ...content,
        image_url: { ...content.image_url, url: `data:${mimeType};base64,${base64}` },
      };
    }
  }

  if (content.type === 'video_url') {
    const { type } = parseDataUri(content.video_url.url);

    const shouldUseBase64 =
      options?.forceVideoBase64 || process.env.LLM_VISION_VIDEO_USE_BASE64 === '1';

    if (type === 'url' && shouldUseBase64) {
      try {
        const { base64, mimeType } = await videoUrlToBase64(content.video_url.url);

        return {
          ...content,
          video_url: { ...content.video_url, url: `data:${mimeType};base64,${base64}` },
        };
      } catch (error) {
        console.warn('Failed to convert video to base64:', error);
        return content;
      }
    }
  }

  return content;
};

export const convertOpenAIMessages = async (
  messages: OpenAI.ChatCompletionMessageParam[],
  options?: ConvertMessageContentOptions,
) => {
  const output: OpenAI.ChatCompletionMessageParam[] = [];
  let generatedImages: OpenAI.ChatCompletionContentPart[] = [];
  const flushImages = () => {
    if (!generatedImages.length) return;
    output.push({
      content: [
        { text: '[Images generated earlier by the assistant]', type: 'text' },
        ...generatedImages,
      ],
      role: 'user',
    });
    generatedImages = [];
  };
  const normalized = normalizeToolHistory(messages as OpenAIChatMessage[]);
  for (const message of normalized) {
    if (message.role !== 'tool') flushImages();
    const msg = toRecord(message)!;
    const result: Record<string, unknown> = { role: message.role };
    if (typeof message.content === 'string') result.content = message.content;
    else if (message.content == null) result.content = message.role === 'assistant' ? null : '';
    else {
      const parts: unknown[] = [];
      for (const part of message.content) {
        if (part.type === 'thinking') continue;
        if (part.type === 'video_url' && !options?.allowVideo) {
          throw new TypeError('This Chat Completions endpoint does not support video input.');
        }
        if (part.type === 'audio_url') {
          if (message.role !== 'user')
            throw new TypeError('Audio inputs must use the user role for Chat Completions.');
          const parsed = parseDataUri(part.audio_url.url);
          const audio =
            parsed.type === 'base64'
              ? { base64: parsed.base64, mimeType: parsed.mimeType }
              : await imageUrlToBase64(part.audio_url.url);
          if (audio.mimeType && !/audio\/(?:wav|x-wav|mpeg|mp3)(?:;|$)/i.test(audio.mimeType))
            throw new TypeError('Chat Completions audio input requires WAV or MP3 data.');
          const format = audio.mimeType?.includes('wav') ? 'wav' : 'mp3';
          if (!audio.base64) throw new TypeError('Audio attachment contains no data.');
          parts.push({ input_audio: { data: audio.base64, format }, type: 'input_audio' });
          continue;
        }
        const converted = await convertMessageContent(
          part as OpenAI.ChatCompletionContentPart,
          options,
        );
        if (message.role === 'assistant' && part.type === 'image_url') {
          generatedImages.push(converted as OpenAI.ChatCompletionContentPartImage);
        } else if (message.role === 'assistant' && part.type !== 'text') {
          throw new TypeError(
            'Assistant history supports text only for this Chat Completions endpoint.',
          );
        } else if (message.role === 'tool' && part.type !== 'text') {
          generatedImages.push(converted as OpenAI.ChatCompletionContentPartImage);
        } else parts.push(converted);
      }
      result.content = parts.length ? parts : message.role === 'assistant' ? null : '';
    }
    if (typeof msg.name === 'string' && message.role !== 'tool') result.name = msg.name;
    if (message.role === 'assistant' && message.tool_calls?.length) {
      result.tool_calls = message.tool_calls.map((call) => ({
        function: { arguments: call.function.arguments, name: call.function.name },
        id: call.id,
        type: 'function',
      }));
    }
    if (message.role === 'tool') result.tool_call_id = message.tool_call_id;
    if (msg.function_call != null) result.function_call = msg.function_call;
    if (
      message.role === 'assistant' &&
      (options?.allowReasoning || isDeepSeekModel(options?.model))
    ) {
      if (typeof msg.reasoning_content === 'string')
        result.reasoning_content = msg.reasoning_content;
      if (msg.reasoning_details !== undefined) result.reasoning_details = msg.reasoning_details;
      const reasoning = toRecord(msg.reasoning);
      if (result.reasoning_content === undefined && typeof reasoning?.content === 'string') {
        result.reasoning_content = reasoning.content;
      }
      if (
        result.reasoning_content === undefined &&
        isDeepSeekThinkingEligibleModel(options?.model)
      ) {
        result.reasoning_content = '';
      }
    }
    if (result.content == null && !result.tool_calls && !result.function_call) continue;
    output.push(result as unknown as OpenAI.ChatCompletionMessageParam);
  }
  flushImages();
  return output;
};

/**
 * Leading system text belongs in Responses instructions, rather than allowing
 * compatible gateways to supply additional default instructions.
 */
export const extractResponseInstructions = (messages: OpenAIChatMessage[]) => {
  const instructions: string[] = [];
  let index = 0;
  for (const message of messages) {
    if (message.role !== 'system' && String(message.role) !== 'developer') break;
    const text =
      typeof message.content === 'string'
        ? message.content
        : Array.isArray(message.content) && message.content.every((part) => part.type === 'text')
          ? message.content.map((part) => (part.type === 'text' ? part.text : '')).join('\n')
          : undefined;
    if (text === undefined) break;
    instructions.push(text);
    index += 1;
  }
  return {
    instructions: index > 0 ? instructions.join('\n\n') : undefined,
    messages: index > 0 ? messages.slice(index) : messages,
  };
};

export const convertOpenAIResponseInputs = async (
  messages: OpenAIChatMessage[],
  options?: ConvertMessageContentOptions,
) => {
  const strictToolPairing = options?.strictToolPairing !== false;
  if (strictToolPairing) messages = normalizeToolHistory(messages);
  messages = relocateAssistantImages(messages);
  // OpenAI Responses API rejects inputs that keep a function_call without its matching
  // function_call_output. Example from production:
  // "No tool output found for function call call_w5odMFjtXEYBBVyBUAQNMOh5."
  const validToolCallIds = new Set<string>();
  const pairedToolOutputIds = new Set<string>();

  for (const message of messages) {
    if (message.role === 'assistant' && message.tool_calls?.length) {
      message.tool_calls.forEach((tool) => {
        if (tool.id) validToolCallIds.add(tool.id);
      });
    }
  }

  for (const message of messages) {
    if (
      message.role === 'tool' &&
      message.tool_call_id &&
      validToolCallIds.has(message.tool_call_id)
    ) {
      pairedToolOutputIds.add(message.tool_call_id);
    }
  }

  const inputGroups = await Promise.all(
    messages.map(async (message) => {
      const items: OpenAI.Responses.ResponseInputItem[] = [];

      // if message is assistant messages with tool calls , transform it to function type item
      if (message.role === 'assistant' && message.tool_calls && message.tool_calls?.length > 0) {
        const toolCalls = strictToolPairing
          ? message.tool_calls.filter((tool) => !!tool.id && pairedToolOutputIds.has(tool.id))
          : message.tool_calls;

        const text =
          typeof message.content === 'string'
            ? message.content
            : (message.content ?? [])
                .filter((part) => part.type === 'text')
                .map((part) => (part.type === 'text' ? part.text : ''))
                .join('\n');
        if (text.trim()) items.push({ content: text, role: 'assistant' });
        toolCalls.forEach((tool) => {
          items.push({
            arguments: tool.function.arguments,
            call_id: tool.id,
            name: tool.function.name,
            type: 'function_call',
          });
        });

        return items;
      }

      if (message.role === 'tool') {
        if (
          strictToolPairing &&
          (!message.tool_call_id || !pairedToolOutputIds.has(message.tool_call_id))
        )
          return items;

        items.push({
          call_id: message.tool_call_id,
          output:
            typeof message.content === 'string'
              ? message.content
              : await Promise.all(
                  (message.content ?? [])
                    .filter((part) => part.type === 'text' || part.type === 'image_url')
                    .map(async (part) =>
                      part.type === 'text'
                        ? { text: part.text, type: 'input_text' as const }
                        : {
                            image_url: (
                              (await convertMessageContent(
                                part as OpenAI.ChatCompletionContentPartImage,
                                options,
                              )) as OpenAI.ChatCompletionContentPartImage
                            ).image_url.url,
                            type: 'input_image' as const,
                          },
                    ),
                ),
          type: 'function_call_output',
        } as OpenAI.Responses.ResponseFunctionToolCallOutputItem);

        return items;
      }

      if (message.role === 'system') {
        const content =
          typeof message.content === 'string'
            ? message.content
            : (message.content ?? [])
                .filter((part) => part.type === 'text')
                .map((part) => (part.type === 'text' ? part.text : ''))
                .join('\n');
        if (content.trim()) items.push({ content, role: 'developer' });
        return items;
      }
      if (message.role === 'function') {
        items.push({
          content: `[Historical function result: ${message.name ?? 'function'}]\n${
            typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
          }`,
          role: 'assistant',
        });
        return items;
      }

      // default item
      // also need handle image

      const processedContent =
        typeof message.content === 'string'
          ? message.content
          : await Promise.all(
              (message.content || []).map(async (c) => {
                if (isInternalThinkingContentPart(c as OpenAICompatibleContentPart)) {
                  return undefined;
                }

                if (c.type === 'text') {
                  // if assistant message, set type to output_text
                  // https://platform.openai.com/docs/guides/text
                  if (message.role === 'assistant') {
                    return { ...c, type: 'output_text' };
                  }
                  return { ...c, type: 'input_text' };
                }

                // Responses API only accepts output_text/refusal inside assistant history.
                // Multimodal parts are valid as model inputs, not as previous assistant outputs.
                if (message.role === 'assistant') {
                  return undefined;
                }

                if (c.type === 'video_url') {
                  throw new TypeError('This Responses endpoint does not support video input.');
                }
                if (c.type === 'audio_url')
                  throw new TypeError('This Responses endpoint does not support audio input.');
                const image = await convertMessageContent(
                  c as OpenAI.ChatCompletionContentPart,
                  options,
                );
                if (!(image as OpenAI.ChatCompletionContentPartImage).image_url?.url) {
                  return undefined;
                }
                return {
                  ...(c.type === 'image_url' && c.image_url.detail
                    ? { detail: c.image_url.detail }
                    : {}),
                  image_url: (image as OpenAI.ChatCompletionContentPartImage).image_url?.url,
                  type: 'input_image',
                };
              }),
            );

      const content =
        typeof processedContent === 'string'
          ? processedContent
          : processedContent.filter((m) => m !== undefined);

      if (Array.isArray(content) && content.length === 0) {
        return items;
      }

      const item = {
        content,
        role: message.role,
      } as OpenAI.Responses.ResponseInputItem;

      // remove reasoning field from the message item
      delete (item as any).reasoning;

      items.push(item);
      return items;
    }),
  );

  return inputGroups.flat();
};

export const pruneReasoningPayload = (payload: ChatStreamPayload) => {
  const shouldStream = payload.stream !== false && !disableStreamModels.has(payload.model);
  const { stream_options, logprobs, top_logprobs, max_tokens, ...cleanedPayload } = payload as any;

  // When reasoning_effort is 'none', allow user-defined temperature/top_p
  const effort = payload.reasoning?.effort || payload.reasoning_effort;
  const isEffortNone = effort === 'none';

  return {
    ...cleanedPayload,
    frequency_penalty: undefined,
    ...(max_tokens !== undefined
      ? payload.apiMode === 'responses'
        ? { max_tokens }
        : { max_completion_tokens: max_tokens }
      : {}),
    messages: payload.messages.map((message: OpenAIChatMessage) => ({
      ...message,
      role:
        message.role === 'system'
          ? systemToUserModels.has(payload.model)
            ? 'user'
            : 'developer'
          : message.role,
    })),
    presence_penalty: undefined,
    stream: shouldStream,
    // Only include stream_options when stream is enabled
    ...(shouldStream && stream_options && { stream_options }),

    /**
     *  In openai docs: https://platform.openai.com/docs/guides/latest-model#gpt-5-2-parameter-compatibility
     *  Fields like `top_p`, `temperature`, `logprobs`, and `top_logprobs` are only supported by
     *  GPT-5 series (e.g. 5-mini 5-nano ) when reasoning effort is none
     */
    logprobs: isEffortNone ? logprobs : undefined,
    temperature: isEffortNone ? payload.temperature : undefined,
    top_logprobs: isEffortNone ? top_logprobs : undefined,
    top_p: isEffortNone ? payload.top_p : undefined,
  };
};

/**
 * Convert image URL (data URL or HTTP URL) to File object for OpenAI API
 */
export const convertImageUrlToFile = async (imageUrl: string) => {
  let buffer: Buffer;
  let mimeType: string;

  if (imageUrl.startsWith('data:')) {
    // a base64 image
    const [mimeTypePart, base64Data] = imageUrl.split(',');
    mimeType = mimeTypePart.split(':')[1].split(';')[0];
    buffer = Buffer.from(base64Data, 'base64');
  } else {
    // a http url
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from ${imageUrl}: ${response.statusText}`);
    }
    buffer = Buffer.from(await response.arrayBuffer());
    mimeType = response.headers.get('content-type') || 'image/png';
  }

  return toFile(buffer, `image.${mimeType.split('/')[1]}`, { type: mimeType });
};
