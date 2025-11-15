# Vercelデプロイ手順

このドキュメントでは、Kazika StudioをVercelにデプロイする手順を説明します。

## 前提条件 

- GitHubアカウント
- Vercelアカウント（無料プランで可）
- Supabaseプロジェクトが作成済み

## 1. GitHubリポジトリの準備

### 1.1 初回のコミット（未実施の場合）

```bash
cd kazika-studio
git add .
git commit -m "Initial commit"
```

### 1.2 GitHubリポジトリの作成とプッシュ

1. GitHubで新しいリポジトリを作成
2. ローカルリポジトリをプッシュ：

```bash
git remote add origin https://github.com/YOUR_USERNAME/kazika-studio.git
git branch -M main
git push -u origin main
```

## 2. Vercelプロジェクトの作成

### 2.1 Vercelにサインイン

1. [Vercel](https://vercel.com)にアクセス
2. GitHubアカウントでサインイン

### 2.2 新規プロジェクトの作成

1. Vercelダッシュボードで「Add New...」→「Project」をクリック
2. GitHubリポジトリ一覧から`kazika-studio`を選択
3. 「Import」をクリック

### 2.3 プロジェクト設定

**Framework Preset**: Next.js（自動検出されます）

**Root Directory**: `./`（デフォルト）

**Build and Output Settings**:
- Build Command: `npm run build`（自動設定）
- Output Directory: `.next`（自動設定）
- Install Command: `npm install`（自動設定）

## 3. 環境変数の設定

### 3.1 必須の環境変数

Vercelダッシュボードの「Environment Variables」セクションで以下を設定：

| 変数名 | 値 | 取得元 |
|--------|-----|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Supabaseダッシュボード > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGc...` | Supabaseダッシュボード > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` | Supabaseダッシュボード > Settings > API > service_role (secret) |

### 3.2 環境変数の追加方法

1. Vercelプロジェクトダッシュボード > Settings > Environment Variables
2. 各変数を追加：
   - **Name**: 変数名を入力
   - **Value**: 値を入力（`.env.local`から確認）
   - **Environment**: Production, Preview, Development すべてにチェック
3. 「Save」をクリック

## 4. デプロイの実行

### 4.1 初回デプロイ

1. 環境変数設定後、「Deploy」ボタンをクリック
2. ビルドログを確認しながら待機（2-3分程度）
3. デプロイ完了後、プレビューURLが表示されます

### 4.2 カスタムドメインの設定（任意）

1. Vercelダッシュボード > Settings > Domains
2. 「Add Domain」でドメインを追加
3. DNS設定を行う（Vercelが指示を表示）

## 5. 自動デプロイの動作確認

### 5.1 コードを変更してプッシュ

```bash
# 何か変更を加える
git add .
git commit -m "Test auto deploy"
git push origin main
```

### 5.2 自動デプロイの確認

1. GitHubにプッシュすると、Vercelが自動検知
2. Vercelダッシュボードで新しいデプロイが開始
3. 完了後、自動的に本番環境に反映

## 6. Supabase認証の設定

### 6.1 Vercel URLの登録

デプロイ後のURL（例：`https://kazika-studio.vercel.app`）をSupabaseに登録：

1. Supabaseダッシュボード > Authentication > URL Configuration
2. **Site URL**: `https://kazika-studio.vercel.app`
3. **Redirect URLs**に以下を追加：
   - `https://kazika-studio.vercel.app/auth/callback`
   - `https://kazika-studio.vercel.app/login`
   - `https://kazika-studio.vercel.app`

### 6.2 メール認証の設定確認

Supabaseダッシュボード > Authentication > Email Templates で、
リダイレクトURLが正しいことを確認

## 7. トラブルシューティング

### ビルドエラーが発生する場合

1. Vercelのビルドログを確認
2. 環境変数が正しく設定されているか確認
3. ローカルで`npm run build`が成功するか確認

### 認証が動作しない場合

1. SupabaseのRedirect URLsが正しいか確認
2. 環境変数`NEXT_PUBLIC_SUPABASE_URL`と`NEXT_PUBLIC_SUPABASE_ANON_KEY`が正しいか確認
3. ブラウザのコンソールでエラーを確認

### データベース接続エラー

1. `SUPABASE_SERVICE_ROLE_KEY`が正しく設定されているか確認
2. Supabaseプロジェクトのステータスを確認
3. RLSポリシーが有効になっているか確認

## 8. デプロイフロー

```
コード変更
   ↓
git commit & push
   ↓
GitHub (main branch)
   ↓
Vercel 自動検知
   ↓
ビルド実行
   ↓
デプロイ完了
   ↓
本番環境に反映
```

## 9. ベストプラクティス

### 9.1 ブランチ戦略

- `main`: 本番環境（自動デプロイ）
- `develop`: 開発環境（Vercel Previewで確認）

### 9.2 環境変数の管理

- 本番環境とプレビュー環境で異なる値を使用可能
- 機密情報は絶対にGitHubにコミットしない

### 9.3 デプロイ前の確認

```bash
# ローカルでビルドテスト
npm run build

# ローカルで本番環境と同じ動作確認
npm run start
```

## 参考リンク

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/app/building-your-application/deploying)
- [Supabase Auth with Vercel](https://supabase.com/docs/guides/auth/server-side/nextjs)
