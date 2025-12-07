# API 認証ガイド

kazika-studio の API は、Chrome Extension などの外部クライアントから利用できる Authorization ヘッダー認証をサポートしています。

## 📋 目次

- [認証方法](#認証方法)
- [API キーの作成](#api-キーの作成)
- [API の使用方法](#api-の使用方法)
- [対応エンドポイント](#対応エンドポイント)
- [セキュリティ](#セキュリティ)
- [トラブルシューティング](#トラブルシューティング)

---

## 認証方法

kazika-studio は3つの認証方法をサポートしています：

### 1. Cookie セッション認証（ブラウザ用）

ブラウザから直接アクセスする場合は、Supabase の Cookie セッション認証が使用されます。

```javascript
// ブラウザでのログイン後、自動的に Cookie が設定される
fetch('/api/workflows')
  .then(res => res.json())
  .then(data => console.log(data));
```

### 2. API キー認証（`sk_` プレフィックス）

長期間有効なアクセスが必要な場合は、API キーを使用します。

```javascript
fetch('https://your-domain.com/api/workflows', {
  headers: {
    'Authorization': 'Bearer sk_xxxxxxxxxxxxxxxx',
    'Content-Type': 'application/json',
  }
});
```

### 3. JWT 認証（Supabase トークン）

Chrome Extension などで Supabase にログイン済みの場合、JWT トークンを使用できます。

```javascript
// Supabase でログイン後、access_token を取得
const { data: { session } } = await supabase.auth.getSession();
const accessToken = session?.access_token;

// JWT トークンで API にアクセス
fetch('https://your-domain.com/api/storage/images/xxx.png', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  }
});
```

**JWT 認証のメリット**:
- ユーザーごとの権限管理（RLS ポリシー適用）
- 自動期限切れ（通常1時間）
- リフレッシュトークンで更新可能

**重要**: 3つの認証方法すべてが同時にサポートされており、いずれか1つが有効であれば API にアクセスできます。トークンの種類は自動的に判別されます（`sk_` で始まる場合は API キー、それ以外は JWT）。

---

## API キーの作成

### 手順

1. kazika-studio にログイン
2. `/settings/api-keys` ページにアクセス
3. 「新しいキーを作成」ボタンをクリック
4. キーの名前を入力（例: "Chrome Extension", "Mobile App"）
5. 「作成」をクリック
6. **表示された API キーをコピー**（⚠️ 1回のみ表示されます）

### API キーの形式

```
sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- プレフィックス: `sk_`（Secret Key）
- 長さ: 35文字
- ランダムな英数字

### API キーの管理

- **一覧表示**: 作成済みの API キーの名前、作成日時、最終使用日時を確認できます
- **削除**: 不要になった API キーを削除できます
- **有効化/無効化**: API キーを一時的に無効化できます（今後実装予定）

---

## API の使用方法

### GET リクエストの例

```javascript
// ワークフロー一覧を取得
const response = await fetch('https://your-domain.com/api/workflows', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer sk_xxxxxxxxxxxxxxxx',
    'Content-Type': 'application/json',
  }
});

const data = await response.json();
console.log(data.workflows);
```

### POST リクエストの例

```javascript
// ワークフローを作成
const response = await fetch('https://your-domain.com/api/workflows', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_xxxxxxxxxxxxxxxx',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'My Workflow',
    description: 'Created from API',
    nodes: [],
    edges: [],
  })
});

const data = await response.json();
console.log(data.workflow);
```

### PUT リクエストの例

```javascript
// ワークフローを更新
const response = await fetch('https://your-domain.com/api/workflows', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer sk_xxxxxxxxxxxxxxxx',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    id: 'workflow-id',
    name: 'Updated Workflow',
    description: 'Updated from API',
    nodes: [...],
    edges: [...],
  })
});

const data = await response.json();
console.log(data.workflow);
```

### DELETE リクエストの例

```javascript
// ワークフローを削除
const response = await fetch('https://your-domain.com/api/workflows?id=workflow-id', {
  method: 'DELETE',
  headers: {
    'Authorization': 'Bearer sk_xxxxxxxxxxxxxxxx',
  }
});

const data = await response.json();
console.log(data.message);
```

---

## 対応エンドポイント

以下のエンドポイントが Authorization ヘッダー認証に対応しています：

### ワークフロー (`/api/workflows`)

| メソッド | エンドポイント | 説明 |
|---------|--------------|------|
| GET | `/api/workflows` | ワークフロー一覧取得 |
| POST | `/api/workflows` | ワークフロー作成 |
| PUT | `/api/workflows` | ワークフロー更新 |
| DELETE | `/api/workflows?id=xxx` | ワークフロー削除 |
| GET | `/api/workflows/[id]` | ワークフロー詳細取得 |

### API キー管理 (`/api/api-keys`)

| メソッド | エンドポイント | 説明 |
|---------|--------------|------|
| GET | `/api/api-keys` | API キー一覧取得 |
| POST | `/api/api-keys` | API キー作成 |
| DELETE | `/api/api-keys?id=xxx` | API キー削除 |
| PATCH | `/api/api-keys/[id]` | API キー更新 |

### その他のエンドポイント

他のエンドポイントも同様に対応する予定です。現在は `/api/workflows` がサンプルとして実装されています。

---

## セキュリティ

### API キーの保管

- **絶対に公開リポジトリにコミットしないでください**
- Chrome Extension では `chrome.storage.local` に保存（暗号化されます）
- 環境変数に保存する場合は `.env` ファイルを `.gitignore` に追加

### HTTPS の使用

- **本番環境では必ず HTTPS を使用してください**
- HTTP での通信は API キーが平文で送信されるため危険です

### API キーのローテーション

- 定期的に新しいキーを作成し、古いキーを削除してください
- 漏洩の疑いがある場合は即座に削除してください

### ハッシュ化

- API キーはデータベースに SHA-256 ハッシュで保存されます
- 平文のキーは作成時に1回のみ表示され、以降は取得できません

### 有効期限

- API キー作成時に有効期限を設定できます（オプション）
- 有効期限が切れたキーは自動的に無効化されます

---

## トラブルシューティング

### 401 Unauthorized エラー

**原因**:
- API キーが無効または間違っている
- Authorization ヘッダーの形式が間違っている
- API キーが削除または無効化されている

**解決策**:
1. API キーが正しいか確認
2. `/settings/api-keys` でキーが有効か確認
3. Authorization ヘッダーが `Bearer <api-key>` の形式であることを確認

```javascript
// ✅ 正しい
'Authorization': 'Bearer sk_xxxxxxxxxxxxxxxx'

// ❌ 間違い
'Authorization': 'sk_xxxxxxxxxxxxxxxx'  // "Bearer " がない
'Authorization': 'Bearer: sk_xxxxxxxxxxxxxxxx'  // コロンは不要
```

### CORS エラー

**原因**:
- Chrome Extension の `manifest.json` に API の URL が含まれていない

**解決策**:
`manifest.json` の `host_permissions` に API の URL を追加：

```json
{
  "host_permissions": [
    "http://localhost:3000/*",
    "https://your-domain.com/*"
  ]
}
```

### 500 Internal Server Error

**原因**:
- データベース接続エラー
- サーバーサイドのバグ

**解決策**:
1. サーバーのログを確認
2. データベース接続が正常か確認
3. API キーが正しくハッシュ化されているか確認

---

## 実装詳細

### データベーススキーマ

```sql
CREATE TABLE kazikastudio.api_keys (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  key_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'
);
```

### 認証フロー

1. クライアントが `Authorization: Bearer <api-key>` ヘッダーを送信
2. サーバーが API キーを SHA-256 でハッシュ化
3. データベースで `key_hash` を検索
4. キーが有効で有効期限内であることを確認
5. 関連付けられたユーザー情報を取得
6. リクエストを処理

### コード例

```typescript
// /lib/auth/apiAuth.ts
export async function authenticateRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const apiKey = authHeader.substring(7);
    const user = await authenticateWithApiKey(apiKey);
    if (user) return user;
  }

  // フォールバック: Cookie セッション
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
```

---

## 参考リンク

- [Chrome Extension サンプルコード](/docs/chrome-extension-example/README.md)
- [Supabase 認証ガイド](/AUTHENTICATION.md)
- [API エンドポイント一覧](/docs/API_ENDPOINTS.md)（今後作成予定）

---

## サポート

問題が発生した場合は、GitHub Issues でお知らせください。
