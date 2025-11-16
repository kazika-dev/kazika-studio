# ワークフローノード設定フォームの共通化

## 概要

`/lib/workflow/formConfigGenerator.ts` と `/components/workflow/` のノード設定フォームを共通化し、コードの重複を削減し、保守性を向上させました。

## アーキテクチャ

### 1. 設定の一元管理

**ファイル**: `/lib/workflow/formConfigGenerator.ts`

各ノードタイプの設定フィールド定義を一元管理します。

```typescript
export interface NodeTypeConfig {
  fields: FormFieldConfig[];
  icon?: string;
  color?: string;
  displayName?: string;
}

export function getNodeTypeConfig(nodeType: string): NodeTypeConfig {
  // ノードタイプごとの設定を返す
}
```

### 2. 動的フォームコンポーネント

**ファイル**: `/components/form/DynamicFormField.tsx`

設定に基づいて動的にフォームフィールドを生成します。

**サポートされているフィールドタイプ**:
- `text` - 単一行テキスト入力
- `textarea` - 複数行テキスト入力
- `select` - セレクトボックス
- `slider` - スライダー（数値範囲選択）
- `switch` - トグルスイッチ（ON/OFF）
- `image` - 単一画像アップロード
- `images` - 複数画像アップロード（最大数指定可能）
- `characterSheet` - キャラクターシート単一選択
- `characterSheets` - キャラクターシート複数選択（最大数指定可能）

### 3. 統一ノード設定コンポーネント

**ファイル**: `/components/workflow/UnifiedNodeSettings.tsx`

全てのノードタイプで共通使用できる統一的なノード設定Drawerコンポーネントです。

**主な機能**:
- ノードタイプに応じた動的フォーム生成
- 自動的なデフォルト値設定
- ノードタイプごとのアイコン・色・表示名の自動適用
- 出力データの表示（テキスト、画像、音声、動画）
- エラー表示
- 保存・削除機能

## サポートされているノードタイプ

### 1. Gemini AI (`gemini`)

**色**: `#ea80fc` (紫)

**設定フィールド**:
- モデル選択（select）
  - Gemini 2.5 Flash（推奨）
  - Gemini 2.5 Pro（高性能）
  - Gemini 2.0 Flash
- プロンプト（textarea）

**デフォルト値**:
- model: `gemini-2.5-flash`

### 2. Nanobana 画像生成 (`nanobana`)

**色**: `#ff6b9d` (ピンク)

**設定フィールド**:
- アスペクト比選択（select）
  - 1:1（正方形）
  - 16:9（横長・ワイド）
  - 9:16（縦長・ポートレート）
  - 4:3（横長・標準）
  - 3:4（縦長・標準）
  - 3:2（横長・写真）
  - 2:3（縦長・写真）
- プロンプト（textarea、必須）
- キャラクターシート選択（characterSheets、最大4つ）
- 参照画像（現時点では手動実装、将来的にimagesタイプに統一予定）

**デフォルト値**:
- aspectRatio: `1:1`

**注意事項**:
- `referenceImages` は現時点では `{mimeType, data}` 形式のまま保持
- 将来的には `storagePath` ベースに統一することを検討

### 3. ElevenLabs TTS (`elevenlabs`)

**色**: `#4fc3f7` (水色)

**設定フィールド**:
- 音声ID選択（select）
  - プリセット音声（George, Rachel, Domi, Bella, Antoni, Elli, Josh, Arnold, Adam, Sam）
  - キャラクターのカスタム音声（動的に読み込み）
- モデル選択（select）
  - Turbo v2.5（推奨・バランス型）
  - Flash v2.5（超高速・低コスト）
  - Multilingual v2（安定）
  - Turbo v2（高速）
  - Monolingual v1（英語のみ）
  - Eleven v3（最高品質・Alpha・要アクセス権）
- テキスト（textarea）

**デフォルト値**:
- voiceId: `JBFqnCBsd6RMkjVDRZzb` (George)
- modelId: `eleven_turbo_v2_5`

**特殊機能**:
- キャラクターシートに登録されたカスタム音声を動的に読み込んで選択肢に追加

### 4. Higgsfield 動画生成 (`higgsfield`)

**色**: `#9c27b0` (紫)

**設定フィールド**:
- プロンプト（textarea）
- ネガティブプロンプト（textarea）
- 動画の長さ（select）
  - 5秒
  - 10秒
- CFG Scale（slider、0-1、ステップ0.1）
- プロンプト自動強化（switch）

**デフォルト値**:
- duration: `5`
- cfgScale: `0.5`
- enhancePrompt: `false`

### 5. 画像入力 (`imageInput`)

**色**: `#9c27b0` (紫)

**設定フィールド**:
- 参照画像（image）

## 既存ノード設定コンポーネントの移行

以下のコンポーネントは `UnifiedNodeSettings` を使用するように簡素化されました:

```typescript
// 例: GeminiNodeSettings.tsx
export default function GeminiNodeSettings({ node, onClose, onUpdate, onDelete }) {
  return (
    <UnifiedNodeSettings
      node={node}
      onClose={onClose}
      onUpdate={onUpdate}
      onDelete={onDelete}
    />
  );
}
```

**移行済みコンポーネント**:
- `GeminiNodeSettings.tsx` (約300行 → 約20行)
- `ElevenLabsNodeSettings.tsx` (約390行 → 約20行)
- `ImageInputNodeSettings.tsx` (約380行 → 約20行)
- `HiggsfieldNodeSettings.tsx` (約430行 → 約25行)
- `NanobanaNodeSettings.tsx` (約740行 → 約25行)

## 新しいノードタイプの追加方法

### ステップ1: formConfigGenerator.tsに設定を追加

```typescript
// lib/workflow/formConfigGenerator.ts
export function getNodeTypeConfig(nodeType: string): NodeTypeConfig {
  switch (nodeType) {
    // ... 既存のケース

    case 'newNodeType':
      return {
        displayName: '新しいノード',
        color: '#ff5722',
        fields: [
          {
            type: 'select',
            name: 'option',
            label: 'オプション',
            required: false,
            options: [
              { label: 'オプション1', value: 'opt1' },
              { label: 'オプション2', value: 'opt2' },
            ],
            helperText: 'オプションを選択してください',
          },
          {
            type: 'textarea',
            name: 'prompt',
            label: 'プロンプト',
            placeholder: 'プロンプトを入力...',
            required: true,
            rows: 6,
            helperText: '入力してください',
          },
        ],
      };

    default:
      return {
        displayName: nodeType,
        fields: [],
      };
  }
}
```

### ステップ2: ノード設定コンポーネントを作成

```typescript
// components/workflow/NewNodeTypeSettings.tsx
'use client';

import { Node } from 'reactflow';
import UnifiedNodeSettings from './UnifiedNodeSettings';

interface NewNodeTypeSettingsProps {
  node: Node;
  onClose: () => void;
  onUpdate: (nodeId: string, config: any) => void;
  onDelete: () => void;
}

export default function NewNodeTypeSettings({
  node,
  onClose,
  onUpdate,
  onDelete
}: NewNodeTypeSettingsProps) {
  return (
    <UnifiedNodeSettings
      node={node}
      onClose={onClose}
      onUpdate={onUpdate}
      onDelete={onDelete}
    />
  );
}
```

### ステップ3: (オプション) デフォルト値のカスタマイズ

デフォルト値をカスタマイズする必要がある場合、`UnifiedNodeSettings.tsx`の初期値設定ロジックに追加します:

```typescript
// components/workflow/UnifiedNodeSettings.tsx
if (defaultValue === undefined) {
  switch (field.type) {
    case 'select':
      if (field.name === 'myCustomField') {
        defaultValue = 'myDefaultValue';
      } else {
        defaultValue = field.options?.[0]?.value || '';
      }
      break;
    // ...
  }
}
```

## DynamicFormFieldの拡張

新しいフィールドタイプを追加する場合:

### 1. FormFieldConfigインターフェースを更新

```typescript
// components/form/DynamicFormField.tsx
export interface FormFieldConfig {
  type: 'text' | 'textarea' | ... | 'newType';
  name: string;
  label: string;
  // 新しいプロパティを追加
  newProperty?: string;
}
```

### 2. レンダリングロジックを追加

```typescript
// components/form/DynamicFormField.tsx
export default function DynamicFormField({ config, value, onChange }) {
  // ... 既存のロジック

  // 新しいフィールドタイプ
  if (config.type === 'newType') {
    return (
      <Box>
        {/* 新しいフィールドの実装 */}
      </Box>
    );
  }

  return null;
}
```

## メリット

### 1. コードの重複削減
- 各ノード設定コンポーネントが数百行から数十行に削減
- 共通のUI・ロジックが一箇所に集約

### 2. 一元管理
- ノード設定フィールドが `formConfigGenerator.ts` で一元管理
- 設定変更が容易

### 3. 保守性向上
- 新しいノードタイプの追加が容易
- バグ修正が一箇所で完結

### 4. 一貫性
- 全てのノード設定UIが統一されたデザインと動作
- ユーザー体験の向上

### 5. 再利用性
- `DynamicFormField` コンポーネントを他の場所でも使用可能
- フォームフィールドの実装を再利用

## 今後の改善案

### 1. referenceImagesの統一
現在、Nanobanaノードの `referenceImages` は `{mimeType, data}` 形式で保存されています。将来的には他の画像フィールドと同様に `storagePath` ベースに統一することを検討します。

### 2. ノード固有のUIコンポーネント
一部のノード（例: Nanobana）には接続状態の表示など固有のUIがあります。必要に応じて `UnifiedNodeSettings` にスロット機能を追加し、ノード固有のUIを挿入できるようにすることを検討します。

### 3. バリデーション機能
フィールドごとのバリデーションルールを `FormFieldConfig` に追加し、自動的にバリデーションを実行する機能を追加します。

### 4. 条件付きフィールド表示
特定のフィールドの値に応じて他のフィールドの表示/非表示を切り替える機能を追加します。

## トラブルシューティング

### 問題: フィールドの値が保存されない

**原因**: `UnifiedNodeSettings` の `handleSave` で、既存の設定を保持しつつ新しい値で更新していますが、一部のフィールドが欠落している可能性があります。

**解決策**: `formConfigGenerator.ts` でフィールドが正しく定義されているか確認してください。

### 問題: デフォルト値が正しく設定されない

**原因**: `UnifiedNodeSettings` の初期値設定ロジックでフィールド名が認識されていません。

**解決策**: `UnifiedNodeSettings.tsx` の `useEffect` 内のデフォルト値設定ロジックに該当するフィールド名を追加してください。

### 問題: カスタム音声が表示されない

**原因**: `DynamicFormField` の `select` タイプで、ElevenLabsの音声IDフィールドが認識されていません。

**解決策**: フィールド名に `elevenlabs_voiceId` が含まれているか確認してください。DynamicFormFieldは `config.name.includes('elevenlabs_voiceId')` で判定しています。

## まとめ

このアーキテクチャにより、ワークフローノード設定フォームの実装が大幅に簡素化され、保守性と拡張性が向上しました。新しいノードタイプの追加は、設定ファイルへの追加と簡単なラッパーコンポーネントの作成だけで完了します。
