# Database Setup Guide

## Supabase データベース初期化

このアプリケーションはワークフローをSupabaseデータベースに保存します。

### 1. データベース接続設定

`.env.local` ファイルに以下の環境変数が設定されていることを確認してください：

```bash
SUPABASE_DB_HOST=your_host
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=your_user
SUPABASE_DB_PASSWORD=your_password
SUPABASE_DB_PORT=5432
```

### 2. データベーステーブルの作成

アプリケーションを起動後、以下のエンドポイントにPOSTリクエストを送信してテーブルを作成します：

```bash
curl -X POST http://localhost:3000/api/workflows/init
```

または、ブラウザのコンソールで：

```javascript
fetch('/api/workflows/init', { method: 'POST' })
  .then(res => res.json())
  .then(data => console.log(data));
```

### 3. 作成されるスキーマとテーブル

#### スキーマ: `kazikastudio`

#### テーブル: `kazikastudio.workflows`

| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | SERIAL PRIMARY KEY | ワークフローID（自動採番） |
| name | VARCHAR(255) | ワークフロー名 |
| description | TEXT | ワークフローの説明 |
| nodes | JSONB | ノードデータ（JSON形式） |
| edges | JSONB | エッジデータ（JSON形式） |
| created_at | TIMESTAMP WITH TIME ZONE | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | 更新日時 |

### 4. API エンドポイント

#### ワークフロー一覧取得
```
GET /api/workflows
```

#### ワークフロー詳細取得
```
GET /api/workflows/{id}
```

#### ワークフロー保存（新規）
```
POST /api/workflows
Body: {
  "name": "ワークフロー名",
  "description": "説明",
  "nodes": [...],
  "edges": [...]
}
```

#### ワークフロー更新
```
PUT /api/workflows
Body: {
  "id": 1,
  "name": "ワークフロー名",
  "description": "説明",
  "nodes": [...],
  "edges": [...]
}
```

#### ワークフロー削除
```
DELETE /api/workflows?id=1
```

### 5. 使い方

1. アプリケーションを起動: `npm run dev`
2. データベーステーブルを初期化（上記の方法で）
3. `/workflow` ページにアクセス
4. ワークフローを作成
5. 右上の「保存」ボタンでSupabaseに保存
6. 「読み込み」ボタンで保存したワークフローを読み込み

## トラブルシューティング

### 接続エラーが発生する場合

- `.env.local` の接続情報が正しいか確認
- Supabaseプロジェクトのファイアウォール設定を確認
- SSL接続が有効になっているか確認

### テーブルが作成できない場合

- データベースユーザーにCREATE SCHEMA権限があるか確認
- 接続先のデータベースが正しいか確認
