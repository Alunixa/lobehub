import { toRecord } from '@lobechat/utils/object';

const internalFields = [
  'apiMode',
  'deploymentName',
  'enabledContextCaching',
  'enabledSearch',
  'imageAspectRatio',
  'imageResolution',
  'mockChunks',
  'mockDelayMs',
  'mockResponse',
  'preserveThinking',
  'provider',
  'responseMode',
  'thinkingBudget',
  'thinkingLevel',
  'urlContext',
];
const chatFields = new Set([
  'messages',
  'model',
  'frequency_penalty',
  'presence_penalty',
  'max_tokens',
  'max_completion_tokens',
  'temperature',
  'top_p',
  'tools',
  'tool_choice',
  'stream',
  'stream_options',
  'response_format',
  'modalities',
  'audio',
  'prediction',
  'logprobs',
  'top_logprobs',
  'logit_bias',
  'seed',
  'stop',
  'n',
  'parallel_tool_calls',
  'user',
  'store',
  'metadata',
  'service_tier',
  'prompt_cache_key',
  'prompt_cache_retention',
  'safety_identifier',
  'verbosity',
  'reasoning_effort',
  'web_search_options',
]);
const extensionFields = new Set([
  'thinking',
  'effort',
  'reasoning',
  'enable_thinking',
  'enable_search',
  'thinking_budget',
  'chat_template_kwargs',
  'search_parameters',
  'search_options',
  'reasoning_split',
  'reasoning_format',
  'include_reasoning',
  'preserve_thinking',
  'reasoning_history',
  'enable_citations',
  'return_citations',
  'search_domain_filter',
  'search_recency_filter',
  'return_images',
  'return_related_questions',
  'top_k',
  'min_p',
  'repetition_penalty',
  'safe_prompt',
  'random_seed',
]);

/** Provider extensions are retained deliberately, never inferred from the SDK alone. */
export const cleanChatPayload = <T extends Record<string, unknown>>(
  payload: T,
  provider: string,
): T => {
  const model = String(payload.model ?? '').toLowerCase();
  const nativeExtensions =
    /^(?:deepseek|moonshot|minimax|qwen|zhipu|mimo|stepfun|hunyuan|xai|openrouter|perplexity|groq|togetherai|fireworksai|siliconcloud|vllm|lmstudio)$/i.test(
      provider,
    ) ||
    /deepseek|moonshot|kimi|minimax|qwen|qvq|qwq|glm|zhipu|mimo|step|hunyuan|hy3|grok/.test(model);
  const result = Object.fromEntries(
    Object.entries(payload).filter(
      ([key]) => chatFields.has(key) || (nativeExtensions && extensionFields.has(key)),
    ),
  ) as T;
  for (const key of internalFields) delete result[key];
  delete result.instructions;
  delete result.text;
  if (!nativeExtensions) delete result.reasoning;
  delete result.truncation;
  if (!nativeExtensions) {
    delete result.thinking;
    delete result.effort;
  }
  if (/^(?:openai|azure|azureai)$/.test(provider) && /claude|gemini/.test(model)) {
    delete result.reasoning_effort;
    delete result.thinking;
    delete result.effort;
    delete result.verbosity;
  }
  if (!Array.isArray(result.tools) || result.tools.length === 0) {
    delete result.tools;
    delete result.tool_choice;
  }
  return result;
};

export const cleanResponsesPayload = (payload: Record<string, unknown>) => {
  const responseFields = new Set([
    'model',
    'input',
    'instructions',
    'background',
    'conversation',
    'include',
    'max_output_tokens',
    'max_tool_calls',
    'metadata',
    'parallel_tool_calls',
    'previous_response_id',
    'prompt',
    'prompt_cache_key',
    'prompt_cache_retention',
    'reasoning',
    'safety_identifier',
    'service_tier',
    'store',
    'stream',
    'stream_options',
    'temperature',
    'text',
    'tool_choice',
    'tools',
    'top_logprobs',
    'top_p',
    'truncation',
    'response_format',
    'logprobs',
  ]);
  const result = Object.fromEntries(
    Object.entries(payload).filter(([key]) => responseFields.has(key)),
  );
  for (const key of [
    ...internalFields,
    'frequency_penalty',
    'presence_penalty',
    'logprobs',
    'stream_options',
    'n',
    'thinking',
    'effort',
    'verbosity',
    'user',
  ])
    delete result[key];
  const format = toRecord(result.response_format);
  const text = toRecord(result.text) ?? {};
  if (format?.type === 'json_schema') {
    result.text = { ...text, format: { ...toRecord(format.json_schema), type: 'json_schema' } };
  } else if (format?.type === 'json_object') {
    result.text = { ...text, format: { type: 'json_object' } };
  }
  delete result.response_format;
  const choice = toRecord(result.tool_choice);
  if (choice?.type === 'function') {
    const fn = toRecord(choice.function);
    if (typeof fn?.name === 'string') result.tool_choice = { name: fn.name, type: 'function' };
  }
  if (payload.logprobs === true) {
    result.include = [
      ...new Set([
        ...(Array.isArray(result.include) ? result.include : []),
        'message.output_text.logprobs',
      ]),
    ];
  }
  if (Array.isArray(result.tools) && result.tools.length === 0) {
    delete result.tools;
    delete result.tool_choice;
  }
  return result;
};
