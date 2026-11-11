export interface CropOptions {
  aspect: number;
  x: number;
  y: number;
  zoom: number;
}

export const getBackgroundCrop = (width: number, height: number, options: CropOptions) => {
  if (![width, height, options.aspect].every((value) => Number.isFinite(value) && value > 0))
    throw new Error('Invalid background image dimensions');
  const zoom = Number.isFinite(options.zoom) ? Math.max(1, Math.min(4, options.zoom)) : 1;
  const cropWidth = Math.min(width, height * options.aspect) / zoom;
  const cropHeight = cropWidth / options.aspect;
  const clamp = (value: number) =>
    Number.isFinite(value) ? Math.max(0, Math.min(100, value)) / 100 : 0.5;
  const scale = Math.min(1, 2560 / Math.max(cropWidth, cropHeight));
  return {
    height: cropHeight,
    left: (width - cropWidth) * clamp(options.x),
    outputHeight: Math.max(1, Math.round(cropHeight * scale)),
    outputWidth: Math.max(1, Math.round(cropWidth * scale)),
    top: (height - cropHeight) * clamp(options.y),
    width: cropWidth,
  };
};

export const cropBackgroundImage = async (
  image: HTMLImageElement,
  options: CropOptions,
  name: string,
): Promise<File> => {
  const crop = getBackgroundCrop(image.naturalWidth, image.naturalHeight, options);
  const canvas = document.createElement('canvas');
  canvas.width = crop.outputWidth;
  canvas.height = crop.outputHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image cropping is unavailable');
  context.drawImage(
    image,
    crop.left,
    crop.top,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Image encoding failed'))),
      'image/webp',
      0.9,
    ),
  );
  return new File([blob], `${name.replace(/\.[^.]+$/, '')}.webp`, { type: blob.type });
};
