import { useCallback, useRef, useState } from 'react';

export const useSaveFeedback = () => {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const failedSave = useRef<(() => Promise<unknown>) | null>(null);
  const epoch = useRef(0);

  const save = useCallback(async (operation: () => Promise<unknown>) => {
    const current = ++epoch.current;
    setStatus('saving');
    try {
      await operation();
      if (current !== epoch.current) return;
      failedSave.current = null;
      setStatus('saved');
    } catch (error) {
      console.error('Failed to save mobile settings:', error);
      if (current !== epoch.current) return;
      failedSave.current = operation;
      setStatus('error');
    }
  }, []);

  const retry = useCallback(async () => {
    if (failedSave.current) await save(failedSave.current);
  }, [save]);

  return { retry, save, status };
};
