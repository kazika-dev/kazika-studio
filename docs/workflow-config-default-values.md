# ワークフロー設定値のデフォルト値反映機能

## 概要

ワークフローエディタ（`/components/workflow`）で設定した値が、`/app/form` ページのデフォルト値として自動的に反映されるようになりました。

## 目的

- ワークフローエディタで「アスペクト比: 16:9」「プロンプト: "a cat"」などと設定した場合、`/form` ページを開いたときに、その値がデフォルトで入力されている状態にする
- ユーザーが毎回同じ値を入力する手間を省く
- ワークフローテンプレートとして使いやすくする

## 実装の詳細

### 1. `formConfigGenerator.ts` の変更

各ノードタイプ（Gemini, Nanobana, Higgsfield, Seedream4, ElevenLabs）で、`node.data.config` から設定値を取得し、`defaultValue` として `FormFieldConfig` に含めるように変更しました。

**変更前**：
```typescript
fields.push({
  ...field,
  name: fieldName,
  label: `${nodeName} ${field.label}`,
  placeholder: node.data.config?.[field.name] || field.placeholder,
  helperText: field.helperText,
});
```

**変更後**：
```typescript
// ノードの設定値をデフォルト値として使用
const defaultValue = node.data.config?.[field.name];

fields.push({
  ...field,
  name: fieldName,
  label: `${nodeName} ${field.label}`,
  placeholder: field.placeholder,
  defaultValue: defaultValue !== undefined ? defaultValue : (field.type === 'images' ? [] : ''),
  helperText: field.helperText,
});
```

### 2. `FormFieldConfig` の型定義に `defaultValue` を追加

`/components/form/DynamicFormField.tsx` の `FormFieldConfig` インターフェースに `defaultValue?: any` を追加しました。

```typescript
export interface FormFieldConfig {
  type: 'text' | 'textarea' | 'image' | 'images' | 'prompt' | 'characterSheet' | 'characterSheets' | 'select' | 'slider' | 'switch' | 'tags' | 'outputSelector';
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  maxImages?: number;
  maxSelections?: number;
  helperText?: string;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
  targetFieldName?: string; // タグ挿入先のフィールド名
  defaultValue?: any; // デフォルト値（ワークフローノードの設定値）
}
```

### 3. `/app/form/page.tsx` で `defaultValue` を初期値として使用

ワークフロー読み込み時に、`defaultValue` が設定されている場合はそれを使用し、なければ型に応じたデフォルト値を使用するように変更しました。

**変更前**：
```typescript
const initialValues: Record<string, any> = {};
if (data.workflow.form_config?.fields) {
  data.workflow.form_config.fields.forEach((field: FormFieldConfig) => {
    if (field.type === 'tags') {
      return;
    }

    if (field.type === 'images') {
      initialValues[field.name] = [];
    } else if (field.type === 'image') {
      initialValues[field.name] = null;
    } else {
      initialValues[field.name] = '';
    }
  });
}
```

**変更後**：
```typescript
const initialValues: Record<string, any> = {};
if (data.workflow.form_config?.fields) {
  data.workflow.form_config.fields.forEach((field: FormFieldConfig) => {
    if (field.type === 'tags') {
      return;
    }

    // defaultValueが設定されている場合はそれを使用、なければデフォルト値
    if (field.defaultValue !== undefined) {
      initialValues[field.name] = field.defaultValue;
    } else if (field.type === 'images' || field.type === 'characterSheets' || field.type === 'outputSelector') {
      initialValues[field.name] = [];
    } else if (field.type === 'image') {
      initialValues[field.name] = null;
    } else if (field.type === 'switch') {
      initialValues[field.name] = false;
    } else if (field.type === 'slider') {
      initialValues[field.name] = field.min || 0;
    } else {
      initialValues[field.name] = '';
    }
  });
}
```

## 動作フロー

1. **ワークフローエディタで設定**
   - ユーザーがNanobanaノードで「アスペクト比: 16:9」「プロンプト: "a beautiful cat"」と設定
   - 「保存」ボタンをクリック
   - `node.data.config` に `{ aspectRatio: '16:9', prompt: 'a beautiful cat' }` が保存される

2. **ワークフロー保存時に `form_config` を自動生成**
   - `generateFormConfig()` が呼ばれる
   - `extractFormFieldsFromNodes()` が各ノードを処理
   - Nanobanaノードの場合、`getNodeTypeConfig('nanobana')` から設定を取得
   - `node.data.config.aspectRatio` → `defaultValue: '16:9'`
   - `node.data.config.prompt` → `defaultValue: 'a beautiful cat'`
   - これらが `form_config.fields` に含まれる

3. **`/form` ページを開く**
   - `/api/workflows/:id` から `form_config` を含むワークフローデータを取得
   - `form_config.fields` から初期値を設定
   - `field.defaultValue !== undefined` なら、その値を使用
   - セレクトボックスに「16:9」、テキストエリアに「a beautiful cat」が最初から表示される

## 影響範囲

### 対応ノードタイプ
- ✅ Gemini
- ✅ Nanobana
- ✅ Higgsfield
- ✅ Seedream4
- ✅ ElevenLabs

### 対応フィールドタイプ
- ✅ `text`, `textarea`, `prompt` - 文字列値
- ✅ `select` - 選択値
- ✅ `slider` - 数値
- ✅ `switch` - boolean
- ✅ `images`, `characterSheets`, `outputSelector` - 配列
- ⚠️ `image` - null/オブジェクト（今後対応予定）

## 後方互換性

- 既存のワークフローで `defaultValue` が設定されていない場合は、従来通り空の値が使用されます
- ワークフローを再保存すると、現在の設定値が `defaultValue` として保存されます

## 今後の改善点

1. **画像フィールド（`image`）のデフォルト値対応**
   - 現在は `storagePath` のみを保存しているが、プレビュー表示に必要な情報も含める

2. **キャラクターシート・Output画像選択のデフォルト値対応**
   - 現在は配列（IDのリスト）のみだが、プレビュー表示に必要な情報も含める

3. **バリデーション**
   - `defaultValue` が `options` に含まれているかチェック
   - 型の整合性チェック

## 参考

- [ワークフローノード設定フォームの共通化](/docs/workflow-form-unification.md)
- [CLAUDE.md](/CLAUDE.md) - アーキテクチャの原則
