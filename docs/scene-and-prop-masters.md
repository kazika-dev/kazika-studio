# シーンマスタ・小物マスタ機能

## 概要

ワークフローで使用するシーン（背景・場所）と小物（アイテム・小道具）を管理するマスタ機能です。キャラクターシートと同様のパターンで実装されています。

## 主要機能

### シーンマスタ (`m_scenes`)

背景画像と場所情報を管理します。

**管理項目:**
- **シーン名** (name): 表示用の名称
- **説明** (description): シーンの詳細説明
- **背景画像** (image_url): GCP Storageに保存された背景画像
- **場所** (location): school, home, outdoor, office, cafe, park, station, shop, other
- **時間帯** (time_of_day): morning, afternoon, evening, night
- **天気** (weather): sunny, cloudy, rainy, snowy
- **雰囲気** (mood): peaceful, tense, romantic, mysterious, cheerful, melancholic
- **プロンプトヒント** (prompt_hint_ja/en): 画像生成用のプロンプトヒント（日本語・英語）
- **タグ** (tags): 検索用のタグ配列

### 小物マスタ (`m_props`)

小道具・アイテムの画像と情報を管理します。

**管理項目:**
- **小物名** (name): 表示用の名称
- **説明** (description): 小物の詳細説明
- **画像** (image_url): GCP Storageに保存された画像
- **カテゴリ** (category): accessory, furniture, food, vehicle, weapon, tool, clothing, electronics, nature, other
- **プロンプトヒント** (prompt_hint_ja/en): 画像生成用のプロンプトヒント（日本語・英語）
- **タグ** (tags): 検索用のタグ配列

## データベーススキーマ

### シーンマスタテーブル (`kazikastudio.m_scenes`)

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `id` | BIGSERIAL | シーンID（主キー） |
| `user_id` | UUID | 所有者ID（NULLは共有シーン） |
| `name` | TEXT | シーン名 |
| `description` | TEXT | 説明 |
| `image_url` | TEXT | 背景画像のストレージパス |
| `location` | TEXT | 場所タイプ |
| `time_of_day` | TEXT | 時間帯 |
| `weather` | TEXT | 天気 |
| `mood` | TEXT | 雰囲気 |
| `prompt_hint_ja` | TEXT | 日本語プロンプトヒント |
| `prompt_hint_en` | TEXT | 英語プロンプトヒント |
| `tags` | TEXT[] | タグ配列 |
| `metadata` | JSONB | 拡張用メタデータ |
| `created_at` | TIMESTAMPTZ | 作成日時 |
| `updated_at` | TIMESTAMPTZ | 更新日時 |

### 小物マスタテーブル (`kazikastudio.m_props`)

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `id` | BIGSERIAL | 小物ID（主キー） |
| `user_id` | UUID | 所有者ID（NULLは共有小物） |
| `name` | TEXT | 小物名 |
| `description` | TEXT | 説明 |
| `image_url` | TEXT | 画像のストレージパス |
| `category` | TEXT | カテゴリ |
| `prompt_hint_ja` | TEXT | 日本語プロンプトヒント |
| `prompt_hint_en` | TEXT | 英語プロンプトヒント |
| `tags` | TEXT[] | タグ配列 |
| `metadata` | JSONB | 拡張用メタデータ |
| `created_at` | TIMESTAMPTZ | 作成日時 |
| `updated_at` | TIMESTAMPTZ | 更新日時 |

### RLSポリシー

両テーブルとも同じポリシー構成:
- **SELECT**: 共有データ（user_id IS NULL）または自分のデータを参照可能
- **INSERT**: 認証済みユーザーのみ作成可能
- **UPDATE/DELETE**: 自分のデータのみ編集・削除可能

## API仕様

### シーンマスタ API

#### GET /api/scene-masters
シーン一覧を取得（署名付きURL付き）

**レスポンス:**
```json
{
  "success": true,
  "scenes": [
    {
      "id": 1,
      "name": "学校の屋上",
      "description": "放課後の穏やかな屋上",
      "image_url": "scenes/rooftop-123.png",
      "location": "school",
      "time_of_day": "evening",
      "weather": "sunny",
      "mood": "peaceful",
      "prompt_hint_ja": "夕暮れ時の学校の屋上、柵越しに街が見える",
      "prompt_hint_en": "school rooftop at sunset, city view through fence, anime style",
      "tags": ["学校", "屋上", "夕暮れ"],
      "signed_url": "https://storage.googleapis.com/..."
    }
  ]
}
```

#### POST /api/scene-masters
新しいシーンを作成（FormData）

#### GET /api/scene-masters/[id]
シーンを個別取得

#### PUT /api/scene-masters/[id]
シーンを更新（FormData、画像変更可能）

#### DELETE /api/scene-masters/[id]
シーンを削除（データベース + GCP Storage）

### 小物マスタ API

#### GET /api/prop-masters
小物一覧を取得（署名付きURL付き）

#### POST /api/prop-masters
新しい小物を作成（FormData）

#### GET /api/prop-masters/[id]
小物を個別取得

#### PUT /api/prop-masters/[id]
小物を更新（FormData、画像変更可能）

#### DELETE /api/prop-masters/[id]
小物を削除（データベース + GCP Storage）

## GCP Storage構造

```
GCP Storage Bucket
├── scenes/              ← シーンマスタの背景画像
│   ├── rooftop-1735567200-abc123.png
│   └── classroom-1735567300-def456.jpg
└── props/               ← 小物マスタの画像
    ├── bag-1735567400-ghi789.png
    └── book-1735567500-jkl012.png
```

## 管理画面

### シーンマスタ管理
- **URL**: `/master/m_scenes`
- **コンポーネント**: `SceneMasterManager.tsx`
- **機能**:
  - テーブル形式での一覧表示（サムネイル付き）
  - 新規作成ダイアログ
  - 編集ダイアログ（画像変更可能）
  - 削除確認ダイアログ

### 小物マスタ管理
- **URL**: `/master/m_props`
- **コンポーネント**: `PropMasterManager.tsx`
- **機能**:
  - テーブル形式での一覧表示（サムネイル付き）
  - 新規作成ダイアログ
  - 編集ダイアログ（画像変更可能）
  - 削除確認ダイアログ

## 使用例

### シーンの作成
```typescript
const formData = new FormData();
formData.append('name', '学校の屋上');
formData.append('description', '放課後の穏やかな屋上');
formData.append('location', 'school');
formData.append('time_of_day', 'evening');
formData.append('weather', 'sunny');
formData.append('mood', 'peaceful');
formData.append('prompt_hint_ja', '夕暮れ時の学校の屋上');
formData.append('prompt_hint_en', 'school rooftop at sunset');
formData.append('tags', JSON.stringify(['学校', '屋上']));
formData.append('image', imageFile);

const response = await fetch('/api/scene-masters', {
  method: 'POST',
  body: formData,
});
```

### 小物の作成
```typescript
const formData = new FormData();
formData.append('name', '学校のカバン');
formData.append('description', '革製の学生カバン');
formData.append('category', 'accessory');
formData.append('prompt_hint_ja', '茶色い革製の学生カバン');
formData.append('prompt_hint_en', 'brown leather school bag');
formData.append('tags', JSON.stringify(['カバン', '学校']));
formData.append('image', imageFile);

const response = await fetch('/api/prop-masters', {
  method: 'POST',
  body: formData,
});
```

## マイグレーション

マイグレーションファイル: `supabase/migrations/20251230000001_create_scenes_and_props_tables.sql`

### 手動実行コマンド
```bash
# Supabase CLIを使用
supabase db push

# または直接PostgreSQLに接続して実行
psql $DATABASE_URL < supabase/migrations/20251230000001_create_scenes_and_props_tables.sql
```

## 今後の拡張予定

1. **ワークフローノードでの利用**
   - シーン選択フィールド（`sceneSelector`）
   - 小物選択フィールド（`propSelector`）

2. **会話生成での利用**
   - シーンマスタからシーンを選択して会話を生成
   - 選択したシーンの `prompt_hint` を画像生成に使用

3. **DynamicFormField への統合**
   - `sceneSelector` / `propSelector` フィールドタイプの追加
   - キャラクターシート選択と同様のUI

## 関連ドキュメント

- [画像素材マスタ](/docs/image-materials-master.md) - 類似実装の参考
- [キャラクターシート](/app/character-sheets) - 同様のパターンで実装
- [CLAUDE.md](/CLAUDE.md) - 開発履歴と変更内容
