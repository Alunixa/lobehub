import { useCallback, useState } from 'react';

/**
 * A settings save replaces the image array without reloading an unchanged <img>.
 * Keep that successful load until another URL loads; resetting on config changes
 * leaves the page opaque forever for a single-image background.
 */
export const useLoadedBackground = () => {
  const [loadedUrl, setLoadedUrl] = useState('');
  const markLoaded = useCallback((url: string) => setLoadedUrl(url), []);
  return { loaded: !!loadedUrl, markLoaded };
};
