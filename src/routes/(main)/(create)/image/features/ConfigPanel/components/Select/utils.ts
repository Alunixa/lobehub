export const parseSizeValue = (value?: string): { height: number; width: number } | null => {
  const match = value?.match(/^(\d+)x(\d+)$/i);
  if (!match) return null;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return null;
  }

  return { height, width };
};

export const isCustomDimensionValid = (dimension: number | null, min?: number, max?: number) =>
  Boolean(dimension && dimension >= (min ?? 1) && (max === undefined || dimension <= max));
