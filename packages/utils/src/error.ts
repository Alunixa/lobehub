// Source copied from: https://github.com/moeru-ai/std/blob/72279973ff997b65672a9c85555c3736554bd9b9/packages/std/src/error/index.ts#L41-L46

import { isRecord, pickString, pickTrimmedString } from './object';

type Nullable<T> = {
  [P in keyof T]: null | T[P];
};

/**
 * ErrorLike utility interface for containing error-like objects.
 */
export type ErrorLike<C = unknown> = Nullable<Partial<Pick<Error, 'stack'>>> &
  Pick<Error, 'message' | 'name'> & { cause?: C };

export const isError = (err: null | undefined | unknown): err is Error => err instanceof Error;

export const isErrorLike = <C = unknown>(err: null | undefined | unknown): err is ErrorLike<C> => {
  if (err == null) return false;

  if (isError(err)) return true;

  if (typeof err !== 'object') return false;

  return (
    'name' in err &&
    typeof err.name === 'string' &&
    'message' in err &&
    typeof err.message === 'string'
  );
};

/**
 * Error.name extractor.
 *
 * @param {Error} err
 * @returns {string | undefined}
 */
export const errorNameFrom = (err: null | undefined | unknown): string | undefined =>
  isErrorLike(err) ? err.name : undefined;

/**
 * Error.message extractor.
 *
 * @param {Error} err
 * @returns {string | undefined}
 */
export const errorMessageFrom = (err: null | undefined | unknown): string | undefined =>
  isErrorLike(err) ? err.message : undefined;

/**
 * Error.stack extractor.
 *
 * @param {Error} err
 * @returns {string | undefined}
 */
export const errorStackFrom = (err: null | undefined | unknown): null | string | undefined =>
  isErrorLike(err) ? (err.stack ?? new Error(errorMessageFrom(err)).stack) : undefined;

/**
 * Error.cause extractor.
 *
 * @param {Error} err
 * @returns {unknown | undefined}
 */
export const errorCauseFrom = <C>(err: null | undefined | unknown): C | undefined => {
  if (!isErrorLike(err) || err.cause == null) return undefined;

  return err.cause as C | undefined;
};

export interface SerializedErrorCause {
  cause?: SerializedErrorCause | string;
  code?: number | string;
  errno?: number | string;
  message?: string;
  name?: string;
  syscall?: string;
}

const MAX_ERROR_CAUSE_DEPTH = 6;

/**
 * Preserve non-enumerable transport diagnostics across JSON and object spreads.
 * Do not copy headers, request bodies, stack traces, or socket addresses.
 */
export const serializeErrorCause = (error: unknown): SerializedErrorCause | string | undefined => {
  const seen = new WeakSet<object>();

  const visit = (value: unknown, depth: number): SerializedErrorCause | string | undefined => {
    if (typeof value === 'string') return value;
    if (!isRecord(value)) return undefined;
    if (seen.has(value)) return '[Circular]';
    if (depth >= MAX_ERROR_CAUSE_DEPTH) return '[Cause depth exceeded]';
    seen.add(value);

    const result: SerializedErrorCause = {};
    for (const key of ['message', 'name', 'syscall'] as const) {
      const text = pickString(value[key]);
      if (text !== undefined) result[key] = text;
    }
    for (const key of ['code', 'errno'] as const) {
      const field = value[key];
      if (typeof field === 'string' || (typeof field === 'number' && Number.isFinite(field))) {
        result[key] = field;
      }
    }

    const cause = visit(value.cause, depth + 1);
    if (cause !== undefined) result.cause = cause;

    return result;
  };

  return visit(error, 0);
};

/**
 * Extracts a useful message from thrown errors and provider-style error payloads.
 */
export const getErrorMessage = (error: unknown, fallback = 'Unknown error'): string => {
  const directString = pickTrimmedString(error);
  if (directString) return directString;
  if (!isRecord(error)) return fallback;

  const directMessage = pickTrimmedString(error.message);
  if (directMessage) return directMessage;

  if (isRecord(error.error)) {
    const nestedMessage = pickTrimmedString(error.error.message);
    if (nestedMessage) return nestedMessage;
  }

  return (
    pickTrimmedString(error.errorType) ||
    pickTrimmedString(error.name) ||
    pickTrimmedString(error.type) ||
    fallback
  );
};
