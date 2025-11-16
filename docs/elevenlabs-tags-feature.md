# ElevenLabs タグ挿入機能

## 概要

ElevenLabs ノードでテキストフィールドにタグを挿入する機能を実装しました。`kazikastudio.eleven_labs_tags` テーブルに登録されたタグをポップアップから選択し、`[タグ名]` 形式でテキストフィールドに挿入できます。

検索機能、日本語名表示、ディスクリプション表示に対応しています。

## 実装日

2025-01-16（初版）
2025-01-16（ポップアップUI、検索機能追加）
2025-01-16（テキストフィールド更新の修正、デバッグログ追加）

## 主な変更内容

### 1. DynamicFormField に tags フィールドタイプを追加

**ファイル**: `/components/form/DynamicFormField.tsx`

- `FormFieldConfig` インターフェースに `'tags'` タイプを追加
- `targetFieldName` プロパティを追加（タグ挿入先のフィールド名を指定）
- `allValues` と `onFieldChange` プロパティを追加（他フィールドへのアクセス・更新用）
- ポップアップダイアログでタグ一覧を表示
- 検索機能実装（英語名、日本語名、ディスクリプションで検索可能）
- 各タグに日本語名、英語名、ディスクリプションを表示
- クリックで対象フィールドにタグを挿入

**UIの特徴**:
- 「タグを選択して挿入」ボタンをクリックするとポップアップが開く
- 検索フィールドでリアルタイム検索
- タグカードにホバーエフェクト
- タグ名は日本語名を優先表示、英語名はChipで表示

### 2. getNodeTypeConfig() に tags フィールドを追加

**ファイル**: `/lib/workflow/formConfigGenerator.ts`

ElevenLabs ノードの設定に以下のフィールドを追加：

```typescript
{
  type: 'tags',
  name: 'elevenLabsTags',
  label: 'タグ挿入',
  required: false,
  targetFieldName: 'text',
  helperText: 'クリックしてテキストフィールドにタグを挿入',
}
```

この設定により、以下の両方に自動的に反映されます：
- ワークフローノード設定（`UnifiedNodeSettings`）
- `/form` ページ（動的フォーム）

### 3. UnifiedNodeSettings の修正

**ファイル**: `/components/workflow/UnifiedNodeSettings.tsx`

DynamicFormField に `allValues` と `onFieldChange` を渡すように修正：

```typescript
<DynamicFormField
  key={field.name}
  config={field}
  value={formValues[field.name]}
  onChange={(value) => handleFormValueChange(field.name, value)}
  allValues={formValues}
  onFieldChange={handleFormValueChange}
/>
```

### 4. /form ページの修正

**ファイル**: `/app/form/page.tsx`

DynamicFormField に `allValues` と `onFieldChange` を渡すように修正：

```typescript
<DynamicFormField
  key={field.name}
  config={field}
  value={formValues[field.name]}
  onChange={(value) => handleFieldChange(field.name, value)}
  allValues={formValues}
  onFieldChange={handleFieldChange}
/>
```

## データベース

### テーブル: kazikastudio.eleven_labs_tags

マイグレーションファイル: `/supabase/migrations/20251115000002_create_eleven_labs_tags_table.sql`

**カラム**:
- `id`: BIGSERIAL PRIMARY KEY
- `name`: TEXT NOT NULL（英語のタグ名）
- `description`: TEXT（英語の説明）
- `name_ja`: TEXT（日本語のタグ名）
- `description_ja`: TEXT（日本語の説明）
- `created_at`: TIMESTAMP WITH TIME ZONE
- `updated_at`: TIMESTAMP WITH TIME ZONE

**初期データ**:
- `emotional` - 感情的
- `calm` - 穏やか
- `energetic` - エネルギッシュ
- `professional` - プロフェッショナル
- `friendly` - フレンドリー
- `serious` - 真面目

## API エンドポイント

### GET /api/eleven-labs-tags

**ファイル**: `/app/api/eleven-labs-tags/route.ts`

ElevenLabs タグ一覧を取得します。

**レスポンス例**:
```json
{
  "success": true,
  "tags": [
    {
      "id": 1,
      "name": "emotional",
      "description": "Emotional tone",
      "name_ja": "感情的",
      "description_ja": "感情を込めた音声"
    },
    ...
  ]
}
```

## 使用方法

### ワークフローノード設定での使用

1. ワークフローエディタで ElevenLabs ノードを選択
2. 設定パネルで「タグを選択して挿入」ボタンをクリック
3. ポップアップが開き、タグ一覧が表示される
4. 検索フィールドでタグを検索（オプション）
5. タグをクリックすると `[タグ名]` 形式でテキストフィールドに挿入される

### /form ページでの使用

1. ElevenLabs ノードを含むワークフローの `/form` ページにアクセス
2. テキストフィールドの下に「タグを選択して挿入」ボタンが表示される
3. ボタンをクリックしてポップアップを開く
4. タグを検索・選択するとテキストフィールドにタグが挿入される

### 検索機能

検索フィールドに入力すると、以下の項目でフィルタリングされます：
- 英語名（`name`）
- 日本語名（`name_ja`）
- 英語ディスクリプション（`description`）
- 日本語ディスクリプション（`description_ja`）

## トラブルシューティング

### タグが挿入されない場合

ブラウザのコンソール（F12キー）を開いて、以下のログを確認してください：

1. `Available field names:` - 利用可能なフィールド名のリスト
2. `Looking for field matching:` - 検索対象のフィールド名
3. `Inserting tag:` - 挿入するタグ名とフィールド名
4. `Current text value:` - 現在のテキスト値
5. `New text value:` - 新しいテキスト値

これらのログで、正しいフィールドが見つかっているか、値が正しく更新されているかを確認できます。

### 既知の問題

- `tags`フィールド自体は状態を持たないため、`formValues`に追加されません
- `targetFieldName`は完全一致を優先し、見つからない場合は部分一致を使用します

## アーキテクチャの原則に準拠

この実装は CLAUDE.md に記載された「設定の一元管理」の原則に準拠しています：

✅ `getNodeTypeConfig()` で一元管理
✅ `extractFormFieldsFromNodes()` が自動的に `getNodeTypeConfig()` を呼び出す
✅ 1箇所の修正で「ワークフローノード設定」と「`/form` ページ」の両方に反映
✅ DRY 原則を徹底

## 今後の拡張

### 新しいタグの追加方法

1. データベースに直接挿入：
```sql
INSERT INTO kazikastudio.eleven_labs_tags (name, description, name_ja, description_ja)
VALUES ('new_tag', 'New Tag Description', '新タグ', '新しいタグの説明');
```

2. `/master` ページから追加（管理UI経由）

### 他のノードタイプへの適用

同様の仕組みを他のノードタイプにも適用できます：

1. `getNodeTypeConfig()` で該当ノードに `tags` フィールドを追加
2. `targetFieldName` でタグ挿入先のフィールドを指定
3. 自動的に両方の UI に反映される

## 参考資料

- [CLAUDE.md](/CLAUDE.md) - プロジェクト開発メモ
- [workflow-form-unification.md](/docs/workflow-form-unification.md) - フォーム共通化のドキュメント
