import type { BackgroundDevice } from '@lobechat/types';
import type { PointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { CropOptions } from '@/features/GlobalBackground/crop';
import { cropBackgroundImage, getBackgroundCrop } from '@/features/GlobalBackground/crop';

export const useCropImage = (file: File, device: BackgroundDevice) => {
  const [loaded, setLoaded] = useState<{ image: HTMLImageElement; url: string }>();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<CropOptions>({
    aspect: device === 'mobile' ? 9 / 16 : 16 / 9,
    x: 50,
    y: 50,
    zoom: 1,
  });
  const drag = useRef<{ left: number; top: number; x: number; y: number } | undefined>(undefined);
  const viewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    let disposed = false;
    const timer = setTimeout(() => {
      if (!disposed) setError(true);
    }, 20_000);
    image.onload = () => {
      clearTimeout(timer);
      if (disposed) return;
      if (
        !image.naturalWidth ||
        !image.naturalHeight ||
        image.naturalWidth * image.naturalHeight > 48_000_000
      ) {
        setError(true);
        return;
      }
      setLoaded({ image, url });
    };
    image.onerror = () => {
      clearTimeout(timer);
      if (!disposed) setError(true);
    };
    image.src = url;
    return () => {
      disposed = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const crop = loaded
    ? getBackgroundCrop(loaded.image.naturalWidth, loaded.image.naturalHeight, options)
    : undefined;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!crop || busy) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { left: crop.left, top: crop.top, x: event.clientX, y: event.clientY };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !crop || !loaded || !viewport.current) return;
    const gesture = drag.current;
    const rect = viewport.current.getBoundingClientRect();
    const width = loaded.image.naturalWidth - crop.width;
    const height = loaded.image.naturalHeight - crop.height;
    setOptions((previous) => ({
      ...previous,
      x: width
        ? Math.max(
            0,
            Math.min(
              100,
              ((gesture.left - ((event.clientX - gesture.x) * crop.width) / rect.width) / width) *
                100,
            ),
          )
        : 50,
      y: height
        ? Math.max(
            0,
            Math.min(
              100,
              ((gesture.top - ((event.clientY - gesture.y) * crop.height) / rect.height) / height) *
                100,
            ),
          )
        : 50,
    }));
  };
  const onPointerUp = () => {
    drag.current = undefined;
  };
  const createFile = async () => {
    if (!loaded) return;
    setBusy(true);
    setError(false);
    try {
      return await cropBackgroundImage(loaded.image, options, file.name);
    } catch (cause) {
      console.error('Background crop failed', cause);
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return {
    busy,
    createFile,
    crop,
    error,
    loaded,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    options,
    setOptions,
    viewport,
  };
};
