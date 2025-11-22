# Kazika Studio

Kazika Studioは、ワークフロー管理システムです。Next.js、Supabase、TypeScriptを使用して構築されています。

## 機能

- ユーザー認証（Supabase Auth）
- ワークフロー管理
- レスポンシブデザイン
- ダークモード対応

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript
- **認証**: Supabase Auth
- **データベース**: Supabase (PostgreSQL)
- **スタイリング**: Tailwind CSS
- **UIコンポーネント**: Material-UI, Lucide Icons
- **ワークフロー可視化**: ReactFlow

## セットアップ

### 前提条件

- Node.js 20以上
- npm、yarn、pnpm、またはbun
- Supabaseアカウント

### インストール

1. リポジトリをクローン

```bash
git clone <repository-url>
cd kazika-studio
```

2. 依存関係をインストール

```bash
npm install
```

3. 環境変数を設定

`.env.local`ファイルを作成し、以下の環境変数を設定：

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Gemini API Key (オプション)
GEMINI_API_KEY=your_api_key
```

詳細は[AUTHENTICATION.md](./AUTHENTICATION.md)を参照してください。

4. データベースマイグレーションを適用

Supabaseダッシュボードで`supabase/migrations/`内のSQLファイルを実行してください。
詳細は[supabase/README.md](./supabase/README.md)を参照してください。

### 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてアプリケーションを表示します。

## ドキュメント

- [認証設定ガイド](./AUTHENTICATION.md) - Supabase認証の設定方法
- [マイグレーションガイド](./supabase/README.md) - データベースマイグレーションの適用方法
- [データベース設計](./DATABASE.md) - データベーススキーマとテーブル構造
- [トラブルシューティング](./TROUBLESHOOTING.md) - 一般的な問題と解決方法

## プロジェクト構造

```
kazika-studio/
├── app/                    # Next.js App Router
│   ├── api/               # APIルート
│   ├── auth/              # 認証関連ページ
│   ├── components/        # グローバルコンポーネント
│   ├── login/             # ログインページ
│   └── workflow/          # ワークフロー管理ページ
├── components/            # 共有コンポーネント
├── lib/                   # ユーティリティとヘルパー
│   └── supabase/          # Supabaseクライアント設定
├── supabase/              # Supabaseマイグレーション
│   └── migrations/        # SQLマイグレーションファイル
└── public/                # 静的ファイル
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


PORT=6000 npx vibe-kanban

/workspaces/kazika-studio/CLAUDE.md