/**
 * @description images for ollama vision models (https://ollama.com/blog/vision-models)
 */
export interface OllamaMessage {
  content: string;
  images?: string[];
  role: string;
  tool_calls?: { function: { arguments: Record<string, unknown>; name: string } }[];
  tool_name?: string;
}
