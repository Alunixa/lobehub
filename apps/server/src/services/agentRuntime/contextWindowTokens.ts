export const resolveContextWindowTokens = (...candidates: unknown[]): number | undefined =>
  candidates.find(
    (candidate): candidate is number =>
      typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate > 0,
  );
