# Supabase認証設定ガイド

このドキュメントでは、Kazika StudioにおけるSupabase認証の設定方法と使用方法について説明します。

## 概要

Kazika Studioは、Supabase Authを使用してユーザー認証を実装しています。以下の機能が含まれています：

- メールアドレス/パスワードでの認証
- アカウント作成（サインアップ）
- ログイン/ログアウト
- セッション管理
- 保護されたルートへのアクセス制御

## 既に実装されている機能

### 1. Supabaseクライアント設定

プロジェクトには3つのSupabaseクライアント設定があります：

#### ブラウザ用クライアント (`lib/supabase/client.ts`)
```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

#### サーバー用クライアント (`lib/supabase/server.ts`)
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Cookie設定処理
        },
      },
    }
  );
}
```

#### 管理者用クライアント (`lib/supabase.ts`)
```typescript
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
```

### 2. 認証ミドルウェア

`middleware.ts`と`lib/supabase/middleware.ts`で、以下の機能を実装：

- セッションの自動更新
- 保護されたルート（`/`、`/workflow`）へのアクセス制御
- 未認証ユーザーを`/login`にリダイレクト
- 認証済みユーザーが`/login`にアクセスした場合、`/`にリダイレクト

### 3. ログイン/サインアップページ

`app/login/page.tsx`で以下を提供：

- メールアドレス/パスワードでのログイン
- 新規アカウント作成
- エラーメッセージ表示
- 成功メッセージ表示
- レスポンシブデザイン

### 4. 認証コールバック

`app/auth/callback/route.ts`で、メール認証リンクからのリダイレクトを処理

### 5. ヘッダーコンポーネント

`app/components/Header.tsx`で以下を提供：

- ユーザー情報表示（メールアドレス）
- ログアウトボタン
- 認証状態の監視

## 環境変数の設定

### 必要な環境変数

`.env.local`ファイルに以下の環境変数を設定してください：

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Supabase Database Connection (オプション)
SUPABASE_DB_HOST=aws-0-ap-northeast-1.pooler.supabase.com
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres.xxxxx
SUPABASE_DB_PASSWORD=your_password
SUPABASE_DB_PORT=6543
```

### 環境変数の取得方法

1. [Supabaseダッシュボード](https://app.supabase.com/)にログイン
2. プロジェクトを選択
3. 「Settings」→「API」に移動
4. 以下をコピー：
   - **Project URL**: `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key**: `SUPABASE_SERVICE_ROLE_KEY`（⚠️ 絶対に公開しないでください）

## Supabaseダッシュボードでの設定

### 1. Email Authを有効化

1. Supabaseダッシュボードで「Authentication」→「Providers」に移動
2. 「Email」プロバイダーが有効になっていることを確認
3. 必要に応じて以下を設定：
   - **Confirm email**: メール確認を必須にする場合はON
   - **Secure email change**: メールアドレス変更時に確認を必要とする場合はON

### 2. Site URLの設定

1. 「Authentication」→「URL Configuration」に移動
2. **Site URL**を設定：
   - 開発環境: `http://localhost:3000`
   - 本番環境: あなたのドメイン（例: `https://yourdomain.com`）

### 3. Redirect URLsの設定

1. 「Authentication」→「URL Configuration」に移動
2. **Redirect URLs**に以下を追加：
   - 開発環境: `http://localhost:3000/auth/callback`
   - 本番環境: `https://yourdomain.com/auth/callback`

## 使用方法

### ログイン

1. アプリケーションを起動: `npm run dev`
2. ブラウザで`http://localhost:3000`にアクセス
3. 未認証の場合、自動的に`/login`にリダイレクトされます
4. メールアドレスとパスワードを入力して「ログイン」をクリック

### 新規アカウント作成

1. `/login`ページで「新規アカウント作成」をクリック
2. メールアドレスとパスワードを入力
3. メール確認が有効な場合、登録したメールアドレスに確認メールが送信されます
4. メール内のリンクをクリックして認証を完了

### ログアウト

1. ヘッダーの「ログアウト」ボタンをクリック
2. 自動的に`/login`ページにリダイレクトされます

## コンポーネントでの認証情報の使用

### クライアントコンポーネント

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export default function MyComponent() {
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();

  useEffect(() => {
    // ユーザー情報を取得
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // 認証状態の変化を監視
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return <div>{user?.email}</div>;
}
```

### サーバーコンポーネント

```typescript
import { createClient } from '@/lib/supabase/server';

export default async function MyServerComponent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return <div>{user?.email}</div>;
}
```

## セキュリティ上の注意

1. **SERVICE_ROLE_KEY**: 絶対に公開しないでください。このキーはすべてのRow Level Security（RLS）ポリシーをバイパスします
2. **ANON_KEY**: クライアント側で使用しても安全ですが、RLSポリシーで適切にデータを保護してください
3. **環境変数**: `.env.local`ファイルを`.gitignore`に追加して、Gitにコミットしないようにしてください

## トラブルシューティング

### ログインできない

1. 環境変数が正しく設定されているか確認
2. Supabaseプロジェクトのステータスを確認
3. ブラウザのコンソールでエラーメッセージを確認

### メール確認メールが届かない

1. Supabaseダッシュボードで「Email Templates」を確認
2. スパムフォルダを確認
3. Supabaseの無料プランでは、1時間あたりのメール送信数に制限があります

### リダイレクトループ

1. ミドルウェアの設定を確認
2. Supabaseの「Redirect URLs」設定を確認
3. ブラウザのキャッシュとCookieをクリア

## 参考リンク

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Next.js App Router + Supabase SSR](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase Email Auth](https://supabase.com/docs/guides/auth/auth-email)
