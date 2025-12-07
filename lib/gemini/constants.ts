/**
 * Gemini AIモデルのオプション
 */
export const GEMINI_MODEL_OPTIONS = [
  { label: 'Gemini 3 Pro Preview (最新)', value: 'gemini-3-pro-preview' },
  { label: 'Gemini 2.5 Flash (推奨)', value: 'gemini-2.5-flash' },
  { label: 'Gemini 2.5 Pro (高性能)', value: 'gemini-2.5-pro' },
  { label: 'Gemini 2.0 Flash Thinking (実験的)', value: 'gemini-2.0-flash-thinking-exp' },
  { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
  { label: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
  { label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' },
] as const;

export type GeminiModel = typeof GEMINI_MODEL_OPTIONS[number]['value'];
