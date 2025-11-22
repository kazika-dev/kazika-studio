/**
 * Gemini AIモデルのオプション
 */
export const GEMINI_MODEL_OPTIONS = [
  { label: 'Gemini 3 Pro Image Preview (最新)', value: 'gemini-3-pro-image-preview' },
  { label: 'Gemini 2.5 Flash (推奨)', value: 'gemini-2.5-flash' },
  { label: 'Gemini 2.5 Pro (高性能)', value: 'gemini-2.5-pro' },
  { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
] as const;

export type GeminiModel = typeof GEMINI_MODEL_OPTIONS[number]['value'];
