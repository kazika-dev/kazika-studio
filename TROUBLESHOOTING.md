# トラブルシューティング

## SSL証明書エラー

### エラーメッセージ
```
Error: self-signed certificate in certificate chain
code: 'SELF_SIGNED_CERT_IN_CHAIN'
```

### 原因
Supabaseの接続でSSL証明書の検証に失敗しています。

### 解決方法

#### 方法1: 開発環境でSSL検証を無効化（既に実装済み）

`lib/db.ts` で `rejectUnauthorized: false` を設定済みです。

サーバーを再起動してください：
```bash
# Ctrl+C でサーバーを停止してから
npm run dev
```

#### 方法2: Supabase REST API（Supabase Client）を使用

PostgreSQL直接接続の代わりに、Supabase REST APIを使用する方法もあります。

#### 方法3: Session Mode Poolerを確認

`.env.local` のポート番号を確認：
- **Transaction mode**: 5432（制限あり）
- **Session mode**: 6543（推奨）

```bash
SUPABASE_DB_PORT=6543
```

#### 方法4: Direct Connection URLを使用

Supabaseダッシュボードから **Direct Connection** の情報を取得して使用。

---

## SCRAM認証エラー

### エラーメッセージ
```
Error: SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature is missing
```

### 原因
Supabase Pooler（Transaction mode）では、SCRAM-SHA-256認証に制限があります。

### 解決方法

#### 方法1: Session Mode Poolerを使用（推奨）

1. Supabaseダッシュボードにアクセス
2. `Project Settings` → `Database` → `Connection string`
3. モードを **Session mode** に変更
4. 接続情報をコピー
5. `.env.local` を更新：

```bash
# Session Mode Poolerの場合
SUPABASE_DB_HOST=aws-0-ap-northeast-1.pooler.supabase.com
SUPABASE_DB_PORT=6543  # Session modeは通常6543
```

#### 方法2: Direct Connectionを使用

1. Supabaseダッシュボードで **Direct connection** を選択
2. 接続情報をコピー
3. `.env.local` を更新：

```bash
# Direct connectionの場合
SUPABASE_DB_HOST=db.xxxxxxxxxxxxxxxx.supabase.co
SUPABASE_DB_PORT=5432
```

#### 方法3: 接続文字列全体を使用

`.env.local` に以下を追加：

```bash
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
```

そして `lib/db.ts` を更新：

```typescript
const connectionString = process.env.DATABASE_URL || `postgresql://...`;
```

### 確認方法

データベース初期化APIをテスト：

```bash
curl -X POST http://localhost:3000/api/workflows/init
```

成功すると：
```json
{
  "success": true,
  "message": "Database initialized successfully"
}
```

### Supabase接続モードの違い

| モード | ポート | 用途 | 制限 |
|--------|--------|------|------|
| **Transaction mode** | 5432 | 短時間のクエリ | SCRAM認証に制限あり |
| **Session mode** | 6543 | 長時間のセッション | 推奨（制限が少ない） |
| **Direct connection** | 5432 | 直接接続 | 最も制限が少ない |

### それでも解決しない場合

1. Supabaseプロジェクトの再起動
2. 接続情報の再確認
3. ファイアウォール設定の確認
4. Supabase Logsでエラー詳細を確認
