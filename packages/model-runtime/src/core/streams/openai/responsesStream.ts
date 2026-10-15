import type { ChatCitationItem, ChatMessageError } from '@lobechat/types';
import type OpenAI from 'openai';
import type { Stream } from 'openai/streaming';

import { AgentRuntimeErrorType } from '../../../types/error';
import { convertOpenAIResponseUsage } from '../../usageConverters';
import type {
  ChatPayloadForTransformStream,
  StreamContext,
  StreamProtocolChunk,
} from '../protocol';
import {
  convertIterableToStream,
  createCallbacksTransformer,
  createFirstErrorHandleTransformer,
  createSSEProtocolTransformer,
  createTokenSpeedCalculator,
  FIRST_CHUNK_ERROR_KEY,
} from '../protocol';
import type { OpenAIStreamOptions } from './openai';
import { ResponsesOutput } from './responsesOutput';

const transformOpenAIStream = (
  chunk:
    | OpenAI.Responses.ResponseStreamEvent
    | {
        delta: string;
        item_id: string;
        type: 'response.reasoning_text.delta';
      }
    | {
        annotation: {
          end_index: number;
          start_index: number;
          title: string;
          type: 'url_citation';
          url: string;
        };
        item_id: string;
        type: 'response.output_text.annotation.added';
      },
  streamContext: StreamContext,
  output: ResponsesOutput,
  payload?: ChatPayloadForTransformStream,
): StreamProtocolChunk | StreamProtocolChunk[] => {
  const createTerminalError = ({
    error,
    eventType,
    responseId,
  }: {
    error: unknown;
    eventType: string;
    responseId?: string;
  }): StreamProtocolChunk => {
    const errorRecord =
      typeof error === 'object' && error !== null
        ? (error as { code?: unknown; message?: unknown; param?: unknown })
        : undefined;
    const message =
      typeof errorRecord?.message === 'string'
        ? errorRecord.message
        : `Responses API stream ended with ${eventType}`;

    return {
      data: {
        body: {
          error,
          eventType,
          provider: payload?.provider,
          responseId,
        },
        message,
        type: AgentRuntimeErrorType.ProviderBizError,
      } satisfies ChatMessageError,
      id: responseId || streamContext.id || 'responses_error',
      type: 'error',
    };
  };

  const createTerminalChunks = ({
    eventType,
    finishReason,
    response,
  }: {
    eventType: string;
    finishReason: string;
    response: {
      id: string;
      status?: string;
      usage?: OpenAI.Responses.ResponseUsage | null;
    };
  }): StreamProtocolChunk[] => {
    const chunks: StreamProtocolChunk[] = [{ data: finishReason, id: response.id, type: 'stop' }];

    if (response.usage) {
      delete streamContext.usageMissingDiagnostics;
      chunks.push({
        data: convertOpenAIResponseUsage(response.usage, payload),
        id: response.id,
        type: 'usage',
      });
    } else {
      streamContext.usageMissingDiagnostics = {
        apiMode: 'responses',
        finishReason,
        hasUsageMetadata: false,
        includeUsageRequested: payload?.includeUsageRequested,
        model: payload?.model,
        provider: payload?.provider,
        responseId: response.id,
        source: 'openai_responses',
        terminalEventType: eventType,
        terminalStatus: response.status,
      };
    }

    chunks.push({ data: response.status || finishReason, id: response.id, type: 'done' });

    return chunks;
  };

  // handle the first chunk error
  if (FIRST_CHUNK_ERROR_KEY in chunk) {
    delete chunk[FIRST_CHUNK_ERROR_KEY];
    // @ts-ignore
    delete chunk['name'];
    // @ts-ignore
    delete chunk['stack'];

    const errorData = {
      body: chunk,
      message:
        'message' in chunk
          ? typeof chunk.message === 'string'
            ? chunk.message
            : JSON.stringify(chunk)
          : JSON.stringify(chunk),
      type:
        'errorType' in chunk
          ? (chunk.errorType as typeof AgentRuntimeErrorType.ProviderBizError)
          : AgentRuntimeErrorType.ProviderBizError,
    } satisfies ChatMessageError;
    return { data: errorData, id: 'first_chunk_error', type: 'error' };
  }

  try {
    switch (chunk.type) {
      case 'response.created': {
        streamContext.id = chunk.response.id;
        streamContext.returnedCitationArray = [];

        return { data: chunk.response.status, id: streamContext.id, type: 'data' };
      }

      case 'response.output_item.added': {
        switch (chunk.item.type) {
          case 'function_call': {
            return output.item(chunk.item, chunk.output_index);
          }
        }

        return { data: chunk.item, id: streamContext.id, type: 'data' };
      }

      case 'response.function_call_arguments.delta': {
        return output.tool(chunk, { arguments: chunk.delta }, false);
      }
      case 'response.function_call_arguments.done': {
        return output.tool(chunk, { arguments: chunk.arguments }, true);
      }
      case 'response.output_text.delta': {
        return output.text(chunk, chunk.delta, 'text');
      }
      case 'response.output_text.done': {
        return output.text(chunk, chunk.text, 'text', true);
      }
      case 'response.refusal.delta': {
        return output.text(chunk, chunk.delta, 'text');
      }
      case 'response.refusal.done': {
        return output.text(chunk, chunk.refusal, 'text', true);
      }
      case 'response.content_part.done': {
        return output.part(chunk, chunk.part);
      }

      case 'response.reasoning_summary_part.added': {
        if (!streamContext.startReasoning) {
          streamContext.startReasoning = true;
          return { data: '', id: chunk.item_id, type: 'reasoning' };
        } else {
          return { data: '\n', id: chunk.item_id, type: 'reasoning' };
        }
      }

      case 'response.reasoning_summary_text.delta': {
        return output.text(chunk, chunk.delta, 'reasoning', false, true);
      }
      case 'response.reasoning_summary_text.done': {
        return output.text(chunk, chunk.text, 'reasoning', true, true);
      }

      // Some OpenAI-compatible endpoints stream raw reasoning rather than
      // a summary. It belongs in the thinking UI, never the visible answer.
      case 'response.reasoning_text.delta': {
        return output.text(chunk, chunk.delta, 'reasoning');
      }

      case 'response.output_text.annotation.added': {
        // OpenAI SDK v6 types the annotation payload as `unknown`; narrow to the URL-citation shape we read.
        const citations = chunk.annotation as { title?: string; url?: string };

        if (streamContext.returnedCitationArray) {
          streamContext.returnedCitationArray.push({
            title: citations.title,
            url: citations.url,
          } as ChatCitationItem);
        }

        return { data: null, id: chunk.item_id, type: 'text' };
      }

      case 'response.output_item.done': {
        const chunks = output.item(chunk.item, chunk.output_index);
        if (streamContext.returnedCitationArray?.length) {
          chunks.push({
            data: { citations: streamContext.returnedCitationArray },
            id: chunk.item.id,
            type: 'grounding',
          });
        }
        return chunks;
      }

      case 'response.completed': {
        return [
          ...(chunk.response.output ?? []).flatMap((item, index) => output.item(item, index)),
          ...createTerminalChunks({
            eventType: chunk.type,
            finishReason: chunk.type,
            response: chunk.response,
          }),
        ];
      }

      case 'response.incomplete': {
        return [
          ...(chunk.response.output ?? []).flatMap((item, index) => output.item(item, index)),
          ...createTerminalChunks({
            eventType: chunk.type,
            finishReason: chunk.response.incomplete_details?.reason || chunk.type,
            response: chunk.response,
          }),
        ];
      }

      case 'response.failed': {
        return createTerminalError({
          error: chunk.response.error,
          eventType: chunk.type,
          responseId: chunk.response.id,
        });
      }

      case 'error': {
        return createTerminalError({
          error: chunk,
          eventType: chunk.type,
          responseId: streamContext.id,
        });
      }

      default: {
        return { data: chunk, id: streamContext.id, type: 'data' };
      }
    }
  } catch (e) {
    const errorName = 'StreamChunkError';
    console.error(`[${errorName}]`, e);
    console.error(`[${errorName}] raw chunk:`, chunk);

    const err = e as Error;

    const errorData = {
      body: {
        message:
          'chat response streaming chunk parse error, please contact your API Provider to fix it.',
        context: { error: { message: err.message, name: err.name }, chunk },
      },
      type: errorName,
    } as ChatMessageError;

    return { data: errorData, id: streamContext.id, type: 'error' };
  }
};

export const OpenAIResponsesStream = (
  stream: Stream<OpenAI.Responses.ResponseStreamEvent> | ReadableStream,
  {
    callbacks,
    bizErrorTypeTransformer,
    inputStartAt,
    enableStreaming = true,
    requireTerminalEvent = true,
    payload,
  }: OpenAIStreamOptions = {},
) => {
  const streamStack: StreamContext = { id: '' };
  const output = new ResponsesOutput(() => streamStack.id);

  const readableStream =
    stream instanceof ReadableStream
      ? stream
      : convertIterableToStream(stream, { model: payload?.model, provider: payload?.provider });

  // use closure to pass payload to transformOpenAIStream
  const transformWithPayload = (
    chunk: Parameters<typeof transformOpenAIStream>[0],
    streamContext: StreamContext,
  ) => transformOpenAIStream(chunk, streamContext, output, payload);

  return (
    readableStream
      // 1. handle the first error if exist
      // provider like huggingface or minimax will return error in the stream,
      // so in the first Transformer, we need to handle the error
      .pipeThrough(createFirstErrorHandleTransformer(bizErrorTypeTransformer, payload?.provider))
      .pipeThrough(
        createTokenSpeedCalculator(transformWithPayload, {
          enableStreaming,
          inputStartAt,
          streamStack,
        }),
      )
      .pipeThrough(createSSEProtocolTransformer((c) => c, streamStack, { requireTerminalEvent }))
      .pipeThrough(createCallbacksTransformer(callbacks, { streamStack }))
  );
};
