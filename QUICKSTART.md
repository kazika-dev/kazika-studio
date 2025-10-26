# クイックスタートガイド

このガイドでは、Kazika Studioを最短時間でセットアップして動作させる方法を説明します。

## 必要なもの

- Node.js 20以上
- [Supabaseアカウント](https://supabase.com/)（無料）

## ステップ1: Supabaseプロジェクトの作成

1. [Supabaseダッシュボード](https://app.supabase.com/)にアクセス
2. 「New Project」をクリック
3. プロジェクト名、データベースパスワード、リージョンを入力
4. 「Create new project」をクリック（数分かかります）

## ステップ2: 環境変数の取得

1. Supabaseダッシュボードで「Settings」→「API」に移動
2. 以下をメモ：
   - **Project URL**
   - **anon/public key**
   - **service_role key**（⚠️ 秘密にしてください）

## ステップ3: プロジェクトのセットアップ

```bash
# プロジェクトディレクトリに移動
cd kazika-studio

# 依存関係をインストール
npm install

# 環境変数ファイルを作成
cp .env.example .env.local
```

`.env.local`ファイルを開いて、ステップ2で取得した値を設定：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## ステップ4: データベースの設定

1. Supabaseダッシュボードで「SQL Editor」を開く
2. 「New query」をクリック
3. `supabase/migrations/20250126000001_create_profiles_table.sql`ファイルの内容をコピー
4. SQLエディタにペーストして「Run」をクリック

## ステップ5: Email Authの設定

1. Supabaseダッシュボードで「Authentication」→「Providers」に移動
2. 「Email」が有効になっていることを確認
3. 「Authentication」→「URL Configuration」に移動
4. 以下を設定：
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs**: `http://localhost:3000/auth/callback`を追加

## ステップ6: アプリケーションの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## ステップ7: 最初のユーザーを作成

1. ログインページが表示されます
2. 「新規アカウント作成」をクリック
3. メールアドレスとパスワードを入力
4. メール確認が有効な場合：
   - 受信メールを確認
   - メール内のリンクをクリック
   - ログインページに戻ってログイン
5. メール確認が無効な場合：
   - すぐにログインできます

## トラブルシューティング

### 「Invalid API key」エラー

- `.env.local`ファイルの環境変数を確認
- 開発サーバーを再起動（`Ctrl+C`で停止して`npm run dev`で再起動）

### メールが届かない

- Supabaseダッシュボードで「Authentication」→「Configuration」→「Email Templates」を確認
- スパムフォルダを確認
- 開発中はメール確認を無効にすることもできます：
  1. 「Authentication」→「Providers」→「Email」
  2. 「Confirm email」をOFF

### ログイン後にリダイレクトされない

- `middleware.ts`の保護されたパスを確認
- ブラウザのコンソールでエラーを確認
- ブラウザのキャッシュとCookieをクリア

## 次のステップ

セットアップが完了したら、以下のドキュメントを参照してください：

- [認証設定の詳細](./AUTHENTICATION.md)
- [データベースマイグレーション](./supabase/README.md)
- [データベース設計](./DATABASE.md)

## 本番環境へのデプロイ

本番環境にデプロイする前に：

1. **環境変数の更新**:
   - `NEXT_PUBLIC_SUPABASE_URL`: 本番のSupabase URL
   - Site URL: 本番ドメイン
   - Redirect URLs: `https://yourdomain.com/auth/callback`

2. **セキュリティ設定**:
   - メール確認を有効化
   - RLSポリシーを確認
   - SERVICE_ROLE_KEYを安全に保管

3. **デプロイ**:
   - Vercel、Netlify、またはその他のプラットフォームにデプロイ
   - 環境変数をデプロイプラットフォームに設定

## サポート

問題が発生した場合は、[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)を参照してください。
