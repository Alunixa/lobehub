import type { RuntimeExecutorContext } from './context';
import { isOperationInterrupted } from './executorHelpers';

/** Follow explicit producer cancellation, never a viewer's HTTP connection. */
export const watchOperationInterruption = (ctx: RuntimeExecutorContext) => {
  const controller = new AbortController();
  let checking = false;
  let disposed = false;
  const check = async () => {
    if (checking || disposed || controller.signal.aborted) return;
    checking = true;
    try {
      if ((await isOperationInterrupted(ctx)) && !disposed) {
        controller.abort(new DOMException('Operation interrupted', 'AbortError'));
      }
    } finally {
      checking = false;
    }
  };
  const timer =
    ctx.getOperationStatus || ctx.loadAgentState
      ? setInterval(() => void check(), 1000)
      : undefined;
  timer?.unref?.();
  return {
    dispose: () => {
      disposed = true;
      clearInterval(timer);
    },
    signal: controller.signal,
  };
};
