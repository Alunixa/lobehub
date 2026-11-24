import { REQUEST_TOPIC_ID_HEADER } from '@lobechat/const';
import type { ChatCompletionErrorPayload, ChatMethodOptions } from '@lobechat/model-runtime';
import { AGENT_RUNTIME_ERROR_SET } from '@lobechat/model-runtime';
import type { UserMemorySettings } from '@lobechat/types';
import { ChatErrorType } from '@lobechat/types';
import { humanMemoryText } from '@lobechat/utils/humanMemory';
import { and, eq } from 'drizzle-orm';

import { checkAuth } from '@/app/(backend)/middleware/auth';
import { UserModel } from '@/database/models/user';
import { topics } from '@/database/schemas';
import { createTraceOptions, initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';
import { HumanMemoryService } from '@/server/services/humanMemory';
import { scheduleHumanMemoryTurn } from '@/server/services/humanMemory/turn';
import { type ChatStreamPayload } from '@/types/openai/chat';
import { createErrorResponse } from '@/utils/errorResponse';
import { getTracePayload } from '@/utils/trace';

import { resolveValidWorkspaceIdFromRequest } from '../../_utils/workspace';

// If user don't use fluid compute, will build  failed
// this enforce user to enable fluid compute
export const maxDuration = 300;
export const runtime = 'nodejs';

export const POST = checkAuth(async (req: Request, { params, userId, serverDB }) => {
  const provider = (await params)!.provider!;

  try {
    const workspaceId = await resolveValidWorkspaceIdFromRequest({ req, serverDB, userId });

    // ============  1. init chat model   ============ //
    const modelRuntime = await initModelRuntimeFromDB(serverDB, userId, provider, workspaceId);

    // ============  2. create chat completion   ============ //

    const data = (await req.json()) as ChatStreamPayload;
    const userSettings = await new UserModel(serverDB, userId).getUserSettings().catch((error) => {
      console.error('[human-memory] settings unavailable; continuing main chat', {
        name: error instanceof Error ? error.name : 'Error',
      });
      return undefined;
    });
    const settings = userSettings?.memory as UserMemorySettings | undefined;
    const userMessage = humanMemoryText(
      data.messages?.findLast((message) => message.role === 'user')?.content,
    );
    const topicHeader = req.headers.get(REQUEST_TOPIC_ID_HEADER);
    let topicId: string | undefined;
    if (topicHeader) {
      const [topic] = await serverDB
        .select({ id: topics.id })
        .from(topics)
        .where(and(eq(topics.userId, userId), eq(topics.id, topicHeader)))
        .limit(1);
      topicId = topic?.id;
    }
    if (settings?.humanMemoryEnabled) {
      const isInstruction = (message: ChatStreamPayload['messages'][number]) =>
        message.role === 'system' || String(message.role) === 'developer';
      const systemMessages = data.messages.filter(isInstruction);
      const prepared = await new HumanMemoryService(serverDB, userId).prepareContext({
        embeddingModel: settings.humanMemoryEmbeddingModel,
        messages: data.messages.filter((message) => !isInstruction(message)),
        userMessage,
        windowSize: settings.humanMemoryWindowSize,
      });
      data.messages = [
        ...(prepared.memoryPrompt
          ? [{ content: prepared.memoryPrompt, role: 'system' as const }]
          : []),
        ...systemMessages,
        ...(prepared.recentMessages as ChatStreamPayload['messages']),
      ];
    }

    const tracePayload = getTracePayload(req);

    let traceOptions: ChatMethodOptions = {};
    // If user enable trace
    if (tracePayload?.enabled) {
      traceOptions = createTraceOptions(data, { provider, trace: tracePayload });
    }

    return await modelRuntime.chat(data, {
      user: userId,
      ...traceOptions,
      signal: req.signal,
      callback: {
        ...traceOptions.callback,
        onFinal: (result) => {
          void traceOptions.callback?.onFinal?.(result);
          if (settings?.humanMemoryEnabled && !result.error && !result.toolsCalling?.length) {
            scheduleHumanMemoryTurn({
              assistantReply: result.text,
              db: serverDB,
              model: data.model,
              provider,
              topicId,
              userId,
              userMessage,
              workspaceId,
            });
          }
        },
      },
    });
  } catch (e) {
    const {
      errorType = ChatErrorType.InternalServerError,
      error: errorContent,
      ...res
    } = e as ChatCompletionErrorPayload;

    const error = errorContent || e;

    const logMethod = AGENT_RUNTIME_ERROR_SET.has(errorType as string) ? 'warn' : 'error';
    // track the error at server side
    // eslint-disable-next-line no-console
    console[logMethod](`Route: [${provider}] ${errorType}:`, error);

    return createErrorResponse(errorType, { error, ...res, provider });
  }
});
