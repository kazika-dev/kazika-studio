/**
 * Nanobana (Gemini Image Generation) モデルのオプション
 */
export const NANOBANA_MODEL_OPTIONS = [
  { label: 'Gemini 2.5 Flash Image (推奨・高速) - $0.039/画像', value: 'gemini-2.5-flash-image' },
  { label: 'Gemini 3 Pro Image Preview (高品質・2K-4K) - 2K:$0.134, 4K:$0.24/画像', value: 'gemini-3-pro-image-preview' },
] as const;

export type NanobanaModel = typeof NANOBANA_MODEL_OPTIONS[number]['value'];

/**
 * モデルごとの解像度制限
 */
export const NANOBANA_RESOLUTION_LIMITS = {
  'gemini-2.5-flash-image': 1024,
  'gemini-3-pro-image-preview': 4096,
} as const;

/**
 * モデルごとの価格情報（参考）
 */
export const NANOBANA_PRICING = {
  'gemini-2.5-flash-image': {
    default: 0.039, // USD per image
  },
  'gemini-3-pro-image-preview': {
    '1K-2K': 0.134, // USD per image
    '4K': 0.24,     // USD per image
  },
} as const;
