# Supabase マイグレーション

このディレクトリにはSupabaseのデータベーススキーマとテーブル定義が含まれています。

## マイグレーション一覧

### 1. `20250126000001_create_profiles_table.sql`
- `public.profiles` テーブルを作成
- ユーザープロフィール情報を管理
- 新規ユーザー登録時に自動的にプロフィールを作成するトリガー

### 2. `20250126000002_create_workflows_table.sql`
- `kazikastudio.workflows` テーブルを作成
- ワークフロー定義を管理（ノードとエッジを含む）
- RLSポリシー設定済み
- 権限自動付与設定

### 3. `20250126000003_create_generated_images_table.sql`
- `kazikastudio.workflow_outputs` テーブルを作成
- ワークフローの出力（画像、動画、音声、テキストなど）を管理
- GCPストレージのURLまたは直接テキストを保存
- RLSポリシー設定済み
- 権限自動付与設定

## 初期セットアップ手順

### 新規Supabaseプロジェクトの場合（推奨）

**ワンステップセットアップ:**

Supabase Dashboard → SQL Editor で以下を実行：

```sql
-- 00000000000000_initial_setup.sql の内容を実行
-- すべてのテーブル、権限、トリガーが一度に作成されます
```

このファイルには以下が含まれています：
- kazikastudioスキーマの作成と権限設定
- profiles テーブル
- workflows テーブル
- workflow_outputs テーブル
- すべてのインデックス、ポリシー、トリガー

### 個別マイグレーションを使用する場合

Supabase Dashboard → SQL Editor で以下のマイグレーションを順番に実行してください：

1. **プロフィールテーブル作成**
   ```bash
   # 20250126000001_create_profiles_table.sql の内容を実行
   ```

2. **ワークフローテーブル作成**
   ```bash
   # 20250126000002_create_workflows_table.sql の内容を実行
   ```

3. **アウトプットテーブル作成**
   ```bash
   # 20250126000003_create_generated_images_table.sql の内容を実行
   ```

### Supabase CLI を使用する場合

```bash
# マイグレーションをローカルで実行
supabase db reset

# またはリモートに適用
supabase db push
```

## スキーマ構造

```
public
  └── profiles (ユーザープロフィール)

kazikastudio
  ├── workflows (ワークフロー定義)
  └── workflow_outputs (ワークフロー出力)
```

## 権限設定

各マイグレーションファイルには以下の権限設定が含まれています：

- テーブル作成後の権限付与
- シーケンスへの権限付与
- デフォルト権限の設定（将来作成されるオブジェクト用）

これにより、新しいテーブルやシーケンスが自動的に適切な権限で作成されます。

## Row Level Security (RLS)

すべてのテーブルでRLSが有効化されており、以下のポリシーが適用されています：

- ユーザーは自分のデータのみ閲覧・編集・削除可能
- `auth.uid()` を使用してユーザー認証を確認

## トラブルシューティング

### 権限エラーが発生する場合

```sql
-- kazikastudioスキーマに権限を付与
GRANT USAGE ON SCHEMA kazikastudio TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA kazikastudio TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA kazikastudio TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA kazikastudio TO anon, authenticated;

-- デフォルト権限を設定
ALTER DEFAULT PRIVILEGES IN SCHEMA kazikastudio GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA kazikastudio GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA kazikastudio GRANT ALL ON FUNCTIONS TO anon, authenticated;
```

### スキーマが表示されない場合

Supabase Dashboard → Settings → API → Exposed schemas に `kazikastudio` を追加してください。

## 注意事項

- マイグレーションは番号順に実行してください
- 本番環境に適用する前に必ずバックアップを取得してください
- RLSポリシーを変更する場合は、セキュリティへの影響を十分に検討してください
