import { AgentRuntimeErrorType } from '@lobechat/types';

/**
 * Thrown when the model returns an empty completion — no text content, no
 * visible tool calls or images, even if reasoning/output tokens were billed. This is the "empty
 * completion" failure mode: after a stalled tool loop the model effectively
 * gives up and emits a blank turn, which the harness used to silently finalize
 * to `done` while persisting an empty assistant message (empty bubble,
 * `status=done, error=null`).
 *
 * The `errorType` field tags it as the retryable `ModelEmptyCompletion` code
 * (see `errors/specs.ts`, which classifies it as a retryable `provider` error)
 * so that:
 *   1. an LLM-error classifier resolves it to `retry`, letting the agent's
 *      `call_llm` retry loop re-attempt the turn (a retry typically yields real
 *      content).
 *   2. If every retry is also empty, the terminal-error formatter enriches it
 *      into a readable, dashboard-visible error instead of a silent `done`.
 */
export class ModelEmptyError extends Error {
  readonly errorType = AgentRuntimeErrorType.ModelEmptyCompletion;

  constructor(
    message = 'Model returned an empty completion (no content, no tool calls, no output tokens).',
  ) {
    super(message);
    this.name = 'ModelEmptyError';
  }
}

/**
 * Detect the "empty completion" failure mode: the model returns a turn with no
 * visible text, tool calls or images —
 * typically after a stalled tool loop where it effectively gives up. Callers
 * throw {@link ModelEmptyError} on a hit so the LLM retry loop re-attempts
 * instead of silently finalizing to `done` with a blank assistant message.
 */
export const isEmptyModelCompletion = (params: {
  content: string;
  imageCount: number;
  outputTokens: number | undefined;
  reasoning: string;
  toolCallCount: number;
}): boolean => {
  const { content, toolCallCount, imageCount } = params;

  if (content.trim().length > 0) return false;
  if (toolCallCount > 0) return false;
  if (imageCount > 0) return false;
  // Usage and internal reasoning are not a visible answer. They must not
  // turn a truncated, rejected or parser-dropped reply into a silent success.
  return true;
};
