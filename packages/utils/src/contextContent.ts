/** Count semantic content, never the base64/URL used to transport a media part. */
export const getContextContentEstimate = (
  content: unknown,
  serialized = false,
): { mediaTokens: number; text: string } => {
  if (typeof content === 'string') {
    if (!serialized) return { mediaTokens: 0, text: content };
    try {
      return getContextContentEstimate(JSON.parse(content));
    } catch {
      return { mediaTokens: 0, text: content };
    }
  }
  if (!Array.isArray(content)) return { mediaTokens: 0, text: '' };
  const texts: string[] = [];
  let mediaTokens = 0;
  for (const value of content) {
    if (!value || typeof value !== 'object') continue;
    const part = value as Record<string, unknown>;
    if (part.type === 'text' || part.type === 'input_text' || part.type === 'output_text') {
      if (typeof part.text === 'string') texts.push(part.text);
    } else if (part.type === 'thinking' || part.type === 'reasoning') {
      if (typeof part.thinking === 'string') texts.push(part.thinking);
      else if (typeof part.text === 'string') texts.push(part.text);
    } else if (
      typeof part.type === 'string' &&
      [
        'image',
        'image_url',
        'input_image',
        'audio',
        'audio_url',
        'input_audio',
        'video',
        'video_url',
        'file',
        'file_url',
        'input_file',
      ].includes(part.type)
    ) {
      // Provider tokenizers depend on resolution/duration/pages, not encoded bytes.
      // Keep this a visible heuristic; provider-reported usage remains authoritative.
      mediaTokens +=
        part.type === 'image_url' &&
        (part.image_url as { detail?: string } | undefined)?.detail === 'low'
          ? 85
          : 1000;
    }
  }
  return { mediaTokens, text: texts.join('\n') };
};
