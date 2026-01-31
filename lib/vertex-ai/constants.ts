/**
 * Conversation model options for Vertex AI and Google Generative AI
 */

export const CONVERSATION_MODEL_OPTIONS = [
  // Gemini Models (via Vertex AI)
  { label: 'Gemini 3 Pro (最新・高性能)', value: 'gemini-3-pro-preview', provider: 'vertex-gemini' as const },
  { label: 'Gemini 2.5 Flash (推奨)', value: 'gemini-2.5-flash-preview-05-20', provider: 'vertex-gemini' as const },
  { label: 'Gemini 2.5 Pro (高性能)', value: 'gemini-2.5-pro-preview-05-06', provider: 'vertex-gemini' as const },
  { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash', provider: 'vertex-gemini' as const },

  // Claude Models (via Anthropic API)
  { label: 'Claude Opus 4.5 (最高性能)', value: 'claude-opus-4-5-20251101', provider: 'anthropic' as const },
  { label: 'Claude Sonnet 4 (バランス)', value: 'claude-sonnet-4-20250514', provider: 'anthropic' as const },
  { label: 'Claude Haiku 3.5 (高速)', value: 'claude-3-5-haiku-20241022', provider: 'anthropic' as const },

  // OpenAI GPT Models (via OpenAI API)
  { label: 'GPT-5.2 (最新)', value: 'gpt-5.2', provider: 'openai' as const },
  { label: 'GPT-5 Mini (高速)', value: 'gpt-5-mini', provider: 'openai' as const },
  { label: 'GPT-4o (バランス)', value: 'gpt-4o', provider: 'openai' as const },

  // Fallback (既存 Google Generative AI API)
  { label: 'Gemini 2.0 Flash Exp (従来API)', value: 'gemini-2.0-flash-exp', provider: 'google-genai' as const },
] as const;

export type ConversationModelOption = typeof CONVERSATION_MODEL_OPTIONS[number];
export type ConversationModel = ConversationModelOption['value'];
export type ModelProvider = ConversationModelOption['provider'];

/**
 * Get the provider for a given model
 */
export function getModelProvider(model: string): ModelProvider {
  const option = CONVERSATION_MODEL_OPTIONS.find(o => o.value === model);
  return option?.provider || 'google-genai';
}

/**
 * Get the label for a given model
 */
export function getModelLabel(model: string): string {
  const option = CONVERSATION_MODEL_OPTIONS.find(o => o.value === model);
  return option?.label || model;
}

/**
 * Default model for conversation generation
 */
export const DEFAULT_CONVERSATION_MODEL: ConversationModel = 'gemini-2.5-flash-preview-05-20';
