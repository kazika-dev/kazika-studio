/**
 * Nanobana (Gemini Image Generation) モデルのオプション
 */
export const NANOBANA_MODEL_OPTIONS = [
  { label: 'Gemini 3 Pro Image Preview (Nano Banana Pro - 高品質、最大4K)', value: 'gemini-3-pro-image-preview' },
  { label: 'Gemini 2.5 Flash Image (高速、低コスト)', value: 'gemini-2.5-flash-image' },
] as const;

export type NanobanaModel = typeof NANOBANA_MODEL_OPTIONS[number]['value'];

/**
 * モデルごとの解像度制限
 */
export const NANOBANA_RESOLUTION_LIMITS = {
  'gemini-3-pro-image-preview': 4096,
  'gemini-2.5-flash-image': 1024,
} as const;

/**
 * モデルごとの価格情報（参考）
 */
export const NANOBANA_PRICING = {
  'gemini-3-pro-image-preview': {
    '1K-2K': 0.134, // USD per image
    '4K': 0.24,     // USD per image
  },
  'gemini-2.5-flash-image': {
    default: 0.039, // USD per image
  },
} as const;
