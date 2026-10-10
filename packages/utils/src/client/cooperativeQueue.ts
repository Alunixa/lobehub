const TASK_BUDGET_MS = 8;
const MAX_TASKS_PER_BATCH = 32;

/**
 * A resolved promise only yields to other microtasks, not to input or paint.
 * Use a task boundary when replaying a buffered stream.
 */
export const yieldToEventLoop = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

export const createCooperativeQueue = () => {
  const tasks: Array<() => Promise<void> | void> = [];
  let head = 0;
  let running = false;

  const drain = async () => {
    let batchStart = performance.now();
    let batchSize = 0;

    try {
      while (head < tasks.length) {
        const task = tasks[head++];
        try {
          await task();
        } catch (error) {
          // A failed reconciliation must not strand every later stream event.
          console.error(error);
        }

        batchSize += 1;
        if (
          head < tasks.length &&
          (batchSize >= MAX_TASKS_PER_BATCH || performance.now() - batchStart >= TASK_BUDGET_MS)
        ) {
          // Release completed closures, which can retain full history snapshots.
          tasks.splice(0, head);
          head = 0;
          await yieldToEventLoop();
          batchStart = performance.now();
          batchSize = 0;
        }
      }
    } finally {
      tasks.length = 0;
      head = 0;
      running = false;
    }
  };

  return (task: () => Promise<void> | void) => {
    tasks.push(task);
    if (running) return;
    running = true;
    // Defer the first batch so adjacent chunks from one network read can merge,
    // but do not wait for another frame (background tabs may suspend frames).
    void Promise.resolve().then(drain);
  };
};
