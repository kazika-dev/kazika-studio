# Supabaseマイグレーション

このディレクトリには、Supabaseデータベースのマイグレーションファイルが含まれています。

## マイグレーションファイル

### 20250126000001_create_profiles_table.sql

ユーザープロファイルテーブルを作成するマイグレーションです。

**含まれる内容：**
- `profiles`テーブルの作成
- Row Level Security（RLS）ポリシーの設定
- 新規ユーザー登録時に自動的にプロファイルを作成するトリガー
- `updated_at`フィールドの自動更新トリガー

**テーブル構造：**
```sql
profiles (
  id UUID PRIMARY KEY,           -- auth.usersのIDを参照
  email TEXT,                     -- ユーザーのメールアドレス
  full_name TEXT,                 -- ユーザーのフルネーム
  avatar_url TEXT,                -- アバター画像のURL
  created_at TIMESTAMP,           -- 作成日時
  updated_at TIMESTAMP            -- 更新日時
)
```

**RLSポリシー：**
- ユーザーは自分のプロファイルのみ閲覧可能
- ユーザーは自分のプロファイルのみ更新可能
- ユーザーは自分のプロファイルのみ作成可能

### 20250126000002_create_workflows_table.sql

ワークフロー管理テーブルを作成するマイグレーションです。

**含まれる内容：**
- `workflows`テーブルの作成
- Row Level Security（RLS）ポリシーの設定
- インデックスの作成（パフォーマンス向上のため）
- `updated_at`フィールドの自動更新トリガー

**テーブル構造：**
```sql
workflows (
  id BIGSERIAL PRIMARY KEY,          -- ワークフローID（自動採番）
  user_id UUID NOT NULL,              -- ユーザーID（auth.usersを参照）
  name TEXT NOT NULL,                 -- ワークフロー名
  description TEXT,                   -- ワークフローの説明
  nodes JSONB NOT NULL,               -- ノード定義（JSON配列）
  edges JSONB NOT NULL,               -- エッジ/接続定義（JSON配列）
  created_at TIMESTAMP,               -- 作成日時
  updated_at TIMESTAMP                -- 更新日時
)
```

**RLSポリシー：**
- ユーザーは自分のワークフローのみ閲覧可能
- ユーザーは自分のワークフローのみ作成可能
- ユーザーは自分のワークフローのみ更新可能
- ユーザーは自分のワークフローのみ削除可能

## マイグレーションの適用順序

**重要**: マイグレーションは以下の順序で適用してください：

1. `20250126000001_create_profiles_table.sql` (プロファイルテーブル)
2. `20250126000002_create_workflows_table.sql` (ワークフローテーブル)

## マイグレーションの適用方法

### 方法1: Supabase SQLエディタを使用（推奨）

1. [Supabaseダッシュボード](https://app.supabase.com/)にログイン
2. プロジェクトを選択
3. 左メニューの「SQL Editor」をクリック
4. 「New query」をクリック
5. マイグレーションファイルの内容をコピー＆ペースト
6. 「Run」をクリックして実行

### 方法2: Supabase CLIを使用

#### CLIのインストール

```bash
# npm経由でインストール
npm install -g supabase

# またはbrewでインストール（macOS）
brew install supabase/tap/supabase
```

#### Supabaseプロジェクトの初期化

```bash
# プロジェクトディレクトリで実行
cd kazika-studio
supabase init
```

#### プロジェクトとの接続

```bash
supabase link --project-ref sxacpyiyanypgmscpjuf
```

#### マイグレーションの適用

```bash
# ローカルでマイグレーションをテスト
supabase db reset

# リモート（本番）にマイグレーションを適用
supabase db push
```

### 方法3: MCPサーバーを使用（開発環境）

Claude CodeのMCPサーバー機能を使用してマイグレーションを適用できます：

```typescript
// Supabaseアクセストークンを設定後
await mcp__supabase__apply_migration({
  name: "create_profiles_table",
  query: "-- マイグレーションのSQLクエリ"
});
```

## マイグレーションの確認

マイグレーションが正常に適用されたか確認するには：

1. Supabaseダッシュボードの「Table Editor」を開く
2. `profiles`テーブルが存在することを確認
3. 「Authentication」→「Policies」で、RLSポリシーが設定されていることを確認

または、SQLエディタで以下のクエリを実行：

```sql
-- テーブルの存在確認
SELECT * FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'profiles';

-- RLSポリシーの確認
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- トリガーの確認
SELECT * FROM information_schema.triggers
WHERE event_object_table = 'users' OR event_object_table = 'profiles';
```

## トラブルシューティング

### エラー: "relation already exists"

テーブルが既に存在する場合は、以下のコマンドでテーブルを削除してから再実行：

```sql
DROP TABLE IF EXISTS public.profiles CASCADE;
```

### エラー: "permission denied"

RLSポリシーが正しく設定されていない可能性があります。以下を確認：

1. `auth.uid()`が正しく機能しているか
2. ポリシーが有効になっているか
3. ユーザーが認証されているか

## 今後のマイグレーション

新しいマイグレーションを追加する場合：

1. `supabase/migrations/`ディレクトリに新しいSQLファイルを作成
2. ファイル名は`YYYYMMDDHHMMSS_description.sql`形式にする
3. マイグレーションを適用する前に、必ずバックアップを取る
4. 本番環境に適用する前に、開発環境でテストする

## 参考リンク

- [Supabase Migrations Documentation](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Triggers](https://supabase.com/docs/guides/database/postgres/triggers)
