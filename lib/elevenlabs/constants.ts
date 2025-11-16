/**
 * ElevenLabs 音声合成APIの定数定義
 * ノード設定とフォーム生成で共通利用
 */

/**
 * プリセット音声一覧
 */
export const ELEVENLABS_PRESET_VOICES = [
  { label: 'George (英語)', value: 'JBFqnCBsd6RMkjVDRZzb' },
  { label: 'Rachel (英語)', value: '21m00Tcm4TlvDq8ikWAM' },
  { label: 'Domi (英語)', value: 'AZnzlk1XvdvUeBnXmlld' },
  { label: 'Bella (英語)', value: 'EXAVITQu4vr4xnSDxMaL' },
  { label: 'Antoni (英語)', value: 'ErXwobaYiN019PkySvjV' },
  { label: 'Elli (英語)', value: 'MF3mGyEYCl7XYWbV9V6O' },
  { label: 'Josh (英語)', value: 'TxGEqnHWrfWFTfGW9XjX' },
  { label: 'Arnold (英語)', value: 'VR6AewLTigWG4xSOukaG' },
  { label: 'Adam (英語)', value: 'pNInz6obpgDQGcFmaJgB' },
  { label: 'Sam (英語)', value: 'yoZ06aMxZJJ28mfd3POQ' },
] as const;

/**
 * 利用可能なモデル一覧
 */
export const ELEVENLABS_MODELS = [
  { label: 'Turbo v2.5 (推奨・バランス型)', value: 'eleven_turbo_v2_5', recommended: true },
  { label: 'Flash v2.5 (超高速・低コスト)', value: 'eleven_flash_v2_5', recommended: false },
  { label: 'Multilingual v2 (安定)', value: 'eleven_multilingual_v2', recommended: false },
  { label: 'Turbo v2 (高速)', value: 'eleven_turbo_v2', recommended: false },
  { label: 'Monolingual v1 (英語のみ)', value: 'eleven_monolingual_v1', recommended: false },
  { label: 'Eleven v3 (最高品質・Alpha・要アクセス権)', value: 'eleven_v3', recommended: false, requiresAccess: true },
] as const;

/**
 * フォーム用モデル一覧（v3を除外）
 */
export const ELEVENLABS_MODELS_FOR_FORM = ELEVENLABS_MODELS.filter(
  model => !model.requiresAccess
);

/**
 * デフォルト値
 */
export const ELEVENLABS_DEFAULTS = {
  voiceId: 'JBFqnCBsd6RMkjVDRZzb', // George
  modelId: 'eleven_turbo_v2_5',     // Turbo v2.5
  stability: 0.5,
  similarityBoost: 0.5,
} as const;
