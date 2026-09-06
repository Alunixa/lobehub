import { useCallback, useRef, useState } from 'react';

export const useSaveFeedback = () => {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const queue = useRef<(() => Promise<unknown>)[]>([]);
  const running = useRef(false);
  const failed = useRef(false);

  const flush = useCallback(async () => {
    if (running.current || !queue.current.length) return;
    running.current = true;
    failed.current = false;
    setStatus('saving');
    try {
      // Serialize patches so a slower older request never overwrites newer edits.
      // A failed patch stays at the head; retry applies it before later edits.
      while (queue.current.length) {
        await queue.current[0]();
        queue.current.shift();
      }
      setStatus('saved');
    } catch (error) {
      console.error('Failed to save mobile settings:', error);
      failed.current = true;
      setStatus('error');
    } finally {
      running.current = false;
    }
  }, []);

  const save = useCallback(
    async (operation: () => Promise<unknown>) => {
      queue.current.push(operation);
      if (!failed.current) await flush();
    },
    [flush],
  );

  return { retry: flush, save, status };
};
