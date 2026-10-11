import { debounce } from 'es-toolkit/compat';
import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { estimateTokenCount } from 'tokenx';

import { encodeAsync } from '@/utils/tokenizer';

export const useTokenCount = (input: string = '') => {
  const [value, setNum] = useState({ count: 0, input: '' });
  const requestVersion = useRef(0);

  const debouncedEncode = useCallback(
    debounce((text: string, version: number) => {
      encodeAsync(text)
        .then((count) => {
          if (version === requestVersion.current) setNum({ count, input: text });
        })
        .catch((error) => {
          if (version !== requestVersion.current) return;
          console.error('Token estimation worker failed:', error);
          setNum({ count: estimateTokenCount(text), input: text });
        });
    }, 300),
    [],
  );

  useEffect(() => {
    const version = ++requestVersion.current;
    startTransition(() => {
      debouncedEncode(input || '', version);
    });

    // Cleanup function
    return () => {
      debouncedEncode.cancel();
      requestVersion.current += 1;
    };
  }, [input, debouncedEncode]);

  return value.input === input ? value.count : 0;
};
