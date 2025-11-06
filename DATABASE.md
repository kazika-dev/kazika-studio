# Database Setup Guide

## Supabase データベース初期化

このアプリケーションはSupabaseデータベースを使用して、ワークフロー、スタジオ、キャラクターシートなどのデータを管理します。

## スキーマ構造

このプロジェクトでは**2つのスキーマ**を使用しています：

### 1. `public` スキーマ
**認証関連のテーブル**を格納

| テーブル名 | 説明 |
|-----------|------|
| profiles | ユーザープロフィール情報 |

### 2. `kazikastudio` スキーマ
**アプリケーション固有のすべてのテーブル**を格納（認証以外）

| テーブル名 | 説明 |
|-----------|------|
| workflows | ワークフロー定義（ノード＆エッジ） |
| workflow_outputs | ワークフロー実行結果（画像、動画、音声など） |
| studios | 動画プロジェクト（スタジオ） |
| studio_boards | ストーリーボード（時系列シーン） |
| studio_board_workflow_steps | ボードのワークフローステップ |
| comfyui_queue | ComfyUIワークフロー処理キュー |
| character_sheets | キャラクターシート情報 |

> **重要**: 新しいテーブルを作成する場合、認証関連以外は必ず`kazikastudio`スキーマに作成してください。

---

## データベース接続設定

### 環境変数の設定

`.env.local` ファイルに以下の環境変数を設定してください：

```bash
# Supabase Database Configuration
SUPABASE_DB_HOST=your-project.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=your-password

# または直接接続文字列を指定
DATABASE_URL=postgresql://postgres:password@host:5432/postgres
```

### コードからの接続

`lib/db.ts`でデータベース接続を管理しています：

```typescript
import { getPool, query } from '@/lib/db';

// クエリ実行の例
const result = await query('SELECT * FROM kazikastudio.workflows WHERE id = $1', [id]);
```

---

## マイグレーション

### マイグレーションファイルの場所

マイグレーションファイルは`supabase/migrations/`ディレクトリに配置されています：

```
supabase/migrations/
├── 00000000000000_initial_setup.sql
├── 20250126000001_create_profiles_table.sql
├── 20250126000002_create_workflows_table.sql
├── 20250126000003_create_generated_images_table.sql
├── 20251103000001_create_studios_tables.sql
├── 20251103000002_create_board_workflow_steps.sql
├── 20251104000001_add_metadata_to_workflow_steps.sql
├── 20251104000002_create_workflow_outputs.sql
├── 20251104000003_add_step_columns_to_workflow_outputs.sql
├── 20251105000001_create_character_sheets_table.sql
└── 20251106000001_move_character_sheets_to_kazikastudio.sql
```

### マイグレーション実行方法

```bash
# マイグレーションを実行
node scripts/run-migration.js supabase/migrations/<migration-file>.sql

# マイグレーション検証
node scripts/verify-migration.js
```

### 新しいマイグレーションの作成

新しいテーブルを作成する場合は、以下のテンプレートを使用してください：

```sql
-- =====================================================
-- [テーブル名] 作成
-- =====================================================

-- kazikastudioスキーマにテーブルを作成
CREATE TABLE IF NOT EXISTS kazikastudio.[table_name] (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- その他のカラム
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_[table_name]_user_id ON kazikastudio.[table_name](user_id);

-- RLS有効化
ALTER TABLE kazikastudio.[table_name] ENABLE ROW LEVEL SECURITY;

-- RLSポリシー作成
CREATE POLICY "Users can view own [table_name]"
  ON kazikastudio.[table_name]
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own [table_name]"
  ON kazikastudio.[table_name]
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own [table_name]"
  ON kazikastudio.[table_name]
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own [table_name]"
  ON kazikastudio.[table_name]
  FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at自動更新用トリガー
CREATE OR REPLACE FUNCTION kazikastudio.update_[table_name]_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_[table_name]_updated_at ON kazikastudio.[table_name];
CREATE TRIGGER update_[table_name]_updated_at
  BEFORE UPDATE ON kazikastudio.[table_name]
  FOR EACH ROW
  EXECUTE FUNCTION kazikastudio.update_[table_name]_updated_at();

-- パーミッション付与
GRANT ALL ON kazikastudio.[table_name] TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE kazikastudio.[table_name]_id_seq TO anon, authenticated;
```

---

## 主要テーブル詳細

### kazikastudio.workflows

ワークフロー定義を保存（ノードとエッジのグラフ構造）

| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | BIGSERIAL | ワークフローID（自動採番） |
| user_id | UUID | ユーザーID（auth.users参照） |
| name | TEXT | ワークフロー名 |
| description | TEXT | ワークフローの説明 |
| nodes | JSONB | ノードデータ（JSON形式） |
| edges | JSONB | エッジデータ（JSON形式） |
| form_config | JSONB | フォーム設定 |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

### kazikastudio.character_sheets

キャラクターシート情報を保存

| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | BIGSERIAL | キャラクターシートID |
| user_id | UUID | ユーザーID |
| name | TEXT | キャラクター名 |
| image_url | TEXT | 画像URL（GCP Storage） |
| description | TEXT | 説明 |
| metadata | JSONB | メタデータ |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

### kazikastudio.studios

動画プロジェクト（スタジオ）を管理

| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | BIGSERIAL | スタジオID |
| user_id | UUID | ユーザーID |
| name | TEXT | プロジェクト名 |
| description | TEXT | プロジェクトの説明 |
| thumbnail_url | TEXT | サムネイル画像URL |
| metadata | JSONB | メタデータ |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

### kazikastudio.comfyui_queue

ComfyUIワークフロー処理のキュー管理

| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | SERIAL | キューID |
| user_id | TEXT | ユーザーID |
| comfyui_workflow_name | TEXT | ワークフロー名 |
| workflow_json | JSONB | ワークフロー定義 |
| status | TEXT | ステータス（pending/processing/completed/failed） |
| priority | INTEGER | 優先度（高いほど先に処理） |
| output_gcp_storage_paths | JSONB | 出力画像パス |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

> その他のテーブル詳細は`docs/database.md`を参照してください。

---

## Row Level Security (RLS)

すべてのテーブルでRLSが有効化されており、ユーザーは自分のデータのみにアクセスできます。

### 基本ポリシー

- **SELECT**: `auth.uid() = user_id` - ユーザーは自分のデータのみ閲覧可能
- **INSERT**: `auth.uid() = user_id` - ユーザーは自分のデータのみ作成可能
- **UPDATE**: `auth.uid() = user_id` - ユーザーは自分のデータのみ更新可能
- **DELETE**: `auth.uid() = user_id` - ユーザーは自分のデータのみ削除可能

### 関連テーブルのポリシー

親テーブルの所有者チェックを経由してアクセス制御を行います：

```sql
-- 例: studio_boardsのポリシー
USING (
  EXISTS (
    SELECT 1 FROM kazikastudio.studios
    WHERE studios.id = studio_boards.studio_id
    AND studios.user_id = auth.uid()
  )
)
```

---

## コード使用例

### lib/db.tsの関数を使用

```typescript
import {
  getWorkflowById,
  getCharacterSheetsByUserId,
  createStudio,
  getBoardsByStudioId,
  createComfyUIQueueItem
} from '@/lib/db';

// ワークフロー取得
const workflow = await getWorkflowById(123);

// キャラクターシート一覧
const sheets = await getCharacterSheetsByUserId('user-uuid');

// スタジオ作成
const studio = await createStudio({
  user_id: 'user-uuid',
  name: 'My Project',
  description: 'Project description'
});

// ボード一覧取得
const boards = await getBoardsByStudioId(studio.id);

// ComfyUIキュー追加
const queueItem = await createComfyUIQueueItem({
  user_id: 'user-uuid',
  comfyui_workflow_name: 'text_to_image',
  workflow_json: { /* workflow definition */ },
  prompt: 'A beautiful landscape'
});
```

---

## トラブルシューティング

### 接続エラー

**問題**: `connection timeout`エラーが発生する

**解決策**:
- `.env.local`の接続情報を確認
- Supabaseプロジェクトのファイアウォール設定を確認
- SSL接続が有効になっているか確認（開発環境では`rejectUnauthorized: false`を使用）

### RLSエラー

**問題**: `permission denied`エラーが発生する

**解決策**:
1. ユーザーが正しく認証されているか確認
2. RLSポリシーが正しく設定されているか確認
3. `auth.uid()`が正しく取得できているか確認（`null`でないことを確認）

### マイグレーションエラー

**問題**: マイグレーション実行時にエラーが発生する

**解決策**:
1. 既存のテーブルやカラムが存在していないか確認
2. 依存関係のある他のテーブルが先に作成されているか確認
3. SQLの構文エラーを確認
4. `IF NOT EXISTS`句を使用して冪等性を確保

### スキーマエラー

**問題**: テーブルが見つからない

**解決策**:
- テーブル名に正しいスキーマプレフィックスを付けているか確認
  - 正しい: `kazikastudio.workflows`
  - 誤り: `workflows` または `public.workflows`
- マイグレーションが正しく実行されているか確認

---

## 参考リンク

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- プロジェクト詳細ドキュメント: `docs/database.md`
