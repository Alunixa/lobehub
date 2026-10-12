import { serializeErrorCause } from '@lobechat/utils/error';
import { toRecord } from '@lobechat/utils/object';
import OpenAI from 'openai';

import type { ILobeAgentRuntimeErrorType } from '../types/error';
import { AgentRuntimeErrorType } from '../types/error';
import { isErrorCausedByContentFilter } from './isErrorCausedByContentFilter';

export const handleOpenAIError = (
  error: unknown,
): { RuntimeError?: ILobeAgentRuntimeErrorType; errorResult: any; message?: string } => {
  let errorResult: any;

  // Check if the error is an OpenAI APIError
  if (error instanceof OpenAI.APIError) {
    // if error is definitely OpenAI APIError, there will be an error object
    if (error.error) {
      errorResult = error.error;
    }
    // Or if there is a cause, we use error cause
    // This often happened when there is a bug of the `openai` package.
    else if (error.cause) {
      errorResult = error.cause instanceof Error ? serializeErrorCause(error.cause) : error.cause;
    }
    // if there is no other request error, the error object is a Response like object
    else {
      errorResult = { headers: error.headers, status: error.status };
    }

    return {
      errorResult,
      message: error.message,
      RuntimeError: isErrorCausedByContentFilter(errorResult)
        ? AgentRuntimeErrorType.ProviderContentPolicyViolation
        : undefined,
    };
  } else {
    const err = toRecord(error);

    errorResult = {
      cause: err?.cause instanceof Error ? serializeErrorCause(err.cause) : err?.cause,
      message: err?.message,
      name: err?.name,
    };

    return {
      RuntimeError: AgentRuntimeErrorType.AgentRuntimeError,
      errorResult,
      message: typeof err?.message === 'string' ? err.message : undefined,
    };
  }
};
