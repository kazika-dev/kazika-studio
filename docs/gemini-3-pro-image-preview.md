# Gemini 3 Pro モデル対応（画像認識・画像生成）

## 概要

Google AI の最新モデルをワークフローエディタと `/form` ページで利用可能にしました：
- **Gemini AI ノード**: `gemini-3-pro-image-preview` (画像認識)
- **Nanobana ノード**: `gemini-3-pro-image` (Nano Banana Pro - 画像生成)

## 変更内容

### 1. Gemini モデル定数の一元管理

#### `/lib/gemini/constants.ts` (新規作成)

```typescript
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
```

**特徴**:
- ElevenLabs と同じパターンでモデルオプションを一元管理
- `as const` で型安全性を確保
- 新しいモデルの追加が容易

### 2. フォーム設定ジェネレーターの更新

#### `/lib/workflow/formConfigGenerator.ts`

```typescript
import { GEMINI_MODEL_OPTIONS } from '@/lib/gemini/constants';

export function getNodeTypeConfig(nodeType: string): NodeTypeConfig {
  switch (nodeType) {
    case 'gemini':
      return {
        displayName: 'Gemini AI',
        color: '#ea80fc',
        fields: [
          {
            type: 'select',
            name: 'model',
            label: 'モデル',
            required: false,
            options: GEMINI_MODEL_OPTIONS, // ← 定数を使用
            helperText: 'APIキーは環境変数から自動的に読み込まれます',
          },
          // ... その他のフィールド
        ],
      };
  }
}
```

**変更点**:
- ハードコードされたオプションを `GEMINI_MODEL_OPTIONS` に置き換え
- `getNodeTypeConfig()` で定義することで、ワークフローノード設定と `/form` ページの両方に自動反映

### 3. API エンドポイント（変更不要）

#### `/app/api/gemini/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const {
    prompt,
    model: requestedModel = 'gemini-2.5-flash',
    images
  } = await request.json();

  // モデル名を動的に使用
  const genAI = new GoogleGenerativeAI(apiKey);
  const generativeModel = genAI.getGenerativeModel({ model: requestedModel });
  // ...
}
```

**ポイント**:
- モデル名を動的に受け取って API に渡すため、新しいモデルも自動的に対応
- `MODEL_MAPPING` で古いモデル名を新しいモデル名に変換する仕組みもある

### 4. Nanobana モデル定数の一元管理

#### `/lib/nanobana/constants.ts` (新規作成)

```typescript
/**
 * Nanobana (Gemini Image Generation) モデルのオプション
 */
export const NANOBANA_MODEL_OPTIONS = [
  { label: 'Gemini 3 Pro Image (Nano Banana Pro - 高品質、最大4K)', value: 'gemini-3-pro-image' },
  { label: 'Gemini 2.5 Flash Image (高速、低コスト)', value: 'gemini-2.5-flash-image' },
] as const;

export type NanobanaModel = typeof NANOBANA_MODEL_OPTIONS[number]['value'];
```

**特徴**:
- Gemini と同じパターンでモデルオプションを一元管理
- 解像度制限や価格情報も定数として定義（参考用）

### 5. Nanobana ノード設定の更新

#### `/lib/workflow/formConfigGenerator.ts`

```typescript
import { NANOBANA_MODEL_OPTIONS } from '@/lib/nanobana/constants';

case 'nanobana':
  return {
    displayName: 'Nanobana 画像生成',
    color: '#ff6b9d',
    fields: [
      {
        type: 'select',
        name: 'model',
        label: 'モデル',
        required: false,
        options: NANOBANA_MODEL_OPTIONS, // ← 定数を使用
        helperText: 'Gemini 3 Pro Imageは高品質・最大4K、Gemini 2.5 Flash Imageは高速・低コスト',
      },
      // ... その他のフィールド
    ],
  };
```

### 6. Nanobana API と Executor の更新

#### `/app/api/nanobana/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const {
    prompt,
    aspectRatio = '1:1',
    model = 'gemini-2.5-flash-image', // ← モデルパラメータを受け取る
    referenceImages
  } = await request.json();

  const generativeModel = genAI.getGenerativeModel({ model }); // ← 動的に使用
  // ...
}
```

#### `/lib/workflow/executor.ts`

```typescript
case 'nanobana':
  requestBody = {
    prompt: nanobanaPrompt,
    aspectRatio: node.data.config?.aspectRatio || '1:1',
    model: node.data.config?.model || 'gemini-2.5-flash-image', // ← ノード設定から取得
    referenceImages: nanobanaImages.length > 0 ? nanobanaImages : undefined,
  };
```

**ポイント**:
- Gemini AI ノードと同じパターンで実装
- API は動的にモデル名を受け取るため、新しいモデルも自動的に対応

### 7. マイグレーション処理

#### `/lib/workflow/migration.ts`

```typescript
// nanobana ノードに model フィールドを追加
if (nodeType === 'nanobana' && config.model === undefined) {
  console.log(`[Migration] Adding model to nanobana node:`, node.id);
  config = {
    ...config,
    model: 'gemini-2.5-flash-image',
  };
  needsUpdate = true;
}
```

**ポイント**:
- 既存のNanobanaノードに `model` フィールドを自動追加
- デフォルトは `gemini-2.5-flash-image` (高速・低コスト)

## 技術的詳細

### 一元管理の原則

```
/lib/gemini/constants.ts (GEMINI_MODEL_OPTIONS)
/lib/nanobana/constants.ts (NANOBANA_MODEL_OPTIONS)
         ↓
/lib/workflow/formConfigGenerator.ts (getNodeTypeConfig)
         ↓
    ┌────┴────┐
    ↓         ↓
ワークフロー   /form
ノード設定    ページ
```

- **1箇所で定義、2箇所に反映**: モデルオプション定数を定義するだけで、両方の UI に自動反映
- **保守性向上**: 新しいモデルの追加が定数ファイルの編集のみで完了
- **型安全性**: TypeScript の `as const` で型を自動推論

### 後方互換性

- **Gemini AI ノード**: 既存のワークフローは影響を受けない（デフォルト: `gemini-2.5-flash`）
- **Nanobana ノード**: 既存のワークフローには `migration.ts` で自動的に `model: 'gemini-2.5-flash-image'` を追加

## 使用方法

### Gemini AI ノードで画像認識

**ワークフローエディタ**:
1. Gemini ノードをワークフローに追加
2. ノード設定を開く
3. 「モデル」ドロップダウンから「Gemini 3 Pro Image Preview (最新)」を選択
4. プロンプトを入力し、必要に応じて画像を接続
5. ワークフローを保存して実行

**`/form` ページ**:
1. ワークフローを選択
2. Gemini ノードの「モデル」フィールドで「Gemini 3 Pro Image Preview (最新)」を選択
3. プロンプトを入力
4. フォームを送信して実行

### Nanobana ノードで画像生成

**ワークフローエディタ**:
1. Nanobana ノードをワークフローに追加
2. ノード設定を開く
3. 「モデル」ドロップダウンから選択：
   - **高品質・4K**: 「Gemini 3 Pro Image (Nano Banana Pro - 高品質、最大4K)」
   - **高速・低コスト**: 「Gemini 2.5 Flash Image (高速、低コスト)」（デフォルト）
4. プロンプト、アスペクト比、参照画像などを設定
5. ワークフローを保存して実行

**`/form` ページ**:
1. ワークフローを選択
2. Nanobana ノードの「モデル」フィールドで希望のモデルを選択
3. プロンプトなどを入力
4. フォームを送信して実行

## モデルの特徴

### Gemini AI ノード（画像認識）

#### Gemini 3 Pro Image Preview
- **最新のモデル**: Google AI の最新の画像認識モデル
- **高精度な画像認識**: 複雑な画像の理解や詳細な説明生成に優れる
- **プレビュー版**: 安定性や可用性は本番リリースより低い可能性がある

#### 使い分けの推奨
- **日常的な使用**: `gemini-2.5-flash` (高速、コスト効率良い)
- **高精度が必要**: `gemini-2.5-pro` または `gemini-3-pro-image-preview`
- **最新機能を試す**: `gemini-3-pro-image-preview`

### Nanobana ノード（画像生成）

#### Gemini 3 Pro Image (Nano Banana Pro)
- **最高品質**: 最大4096px解像度での画像生成が可能
- **高精度なテキストレンダリング**: 画像内のテキストを正確に描画
- **物理的リアリズム**: ライティング、カメラ、焦点、色調補正などを高度に制御
- **価格**: $0.134/画像 (1K-2K解像度)、$0.24/画像 (4K解像度)

#### Gemini 2.5 Flash Image (デフォルト)
- **高速・低コスト**: 最大1024px解像度、$0.039/画像
- **大量生成に最適**: 低レイテンシー、高スループット
- **10種類のアスペクト比**: シネマティックから縦長SNS投稿まで対応

#### 使い分けの推奨
- **プロトタイピング・大量生成**: `gemini-2.5-flash-image` (高速、低コスト)
- **高品質・プロダクション**: `gemini-3-pro-image` (4K、高精度テキスト)
- **テキスト入り画像**: `gemini-3-pro-image` (テキストレンダリングが優秀)

## 今後の拡張

### Gemini AI ノードに新しいモデルを追加

1. `/lib/gemini/constants.ts` の `GEMINI_MODEL_OPTIONS` に追加
2. 以上！（ワークフローノード設定と `/form` ページに自動反映される）

```typescript
export const GEMINI_MODEL_OPTIONS = [
  { label: 'Gemini 4 Ultra (架空)', value: 'gemini-4-ultra' }, // ← 追加
  { label: 'Gemini 3 Pro Image Preview (最新)', value: 'gemini-3-pro-image-preview' },
  // ...
] as const;
```

### Nanobana ノードに新しいモデルを追加

1. `/lib/nanobana/constants.ts` の `NANOBANA_MODEL_OPTIONS` に追加
2. 以上！（ワークフローノード設定と `/form` ページに自動反映される）

```typescript
export const NANOBANA_MODEL_OPTIONS = [
  { label: 'Gemini 4 Flash Image (架空)', value: 'gemini-4-flash-image' }, // ← 追加
  { label: 'Gemini 3 Pro Image (Nano Banana Pro - 高品質、最大4K)', value: 'gemini-3-pro-image' },
  // ...
] as const;
```

## 参考資料

- [Google AI Gemini API ドキュメント](https://ai.google.dev/gemini-api/docs/models?hl=ja#gemini-3-pro)
- [ワークフローノード設定フォームの共通化](/docs/workflow-form-unification.md)
- [CLAUDE.md](/CLAUDE.md) - アーキテクチャの原則
