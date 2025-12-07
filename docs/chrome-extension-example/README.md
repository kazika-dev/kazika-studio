# Chrome Extension サンプル - Kazika Studio API Client

このディレクトリには、Chrome Extension から kazika-studio の API を利用するサンプルコードが含まれています。

## 📁 ファイル構成

```
chrome-extension-example/
├── manifest.json      # Chrome Extension のマニフェストファイル
├── popup.html         # ポップアップ UI
├── popup.js           # ポップアップのロジック
├── background.js      # バックグラウンドスクリプト
└── README.md          # このファイル
```

## 🚀 セットアップ手順

### 1. API キーを作成

1. kazika-studio にログイン
2. `/settings/api-keys` ページにアクセス
3. 「新しいキーを作成」ボタンをクリック
4. 名前（例: "Chrome Extension"）を入力
5. 作成された API キーをコピー（⚠️ 1回のみ表示されます）

### 2. Chrome Extension をインストール

1. Chrome で `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. このディレクトリ (`docs/chrome-extension-example/`) を選択

### 3. 設定

1. 拡張機能のアイコンをクリック
2. API URL を入力（例: `http://localhost:3000` または `https://your-domain.com`）
3. API Key を入力（手順1で作成したキー）
4. 「設定を保存」をクリック

### 4. 動作確認

1. 「ワークフローを取得」ボタンをクリック
2. ワークフロー一覧が JSON 形式で表示されれば成功

## 🔧 カスタマイズ

### 他の API エンドポイントを呼び出す

`popup.js` を編集して、他のエンドポイントを呼び出せます：

```javascript
// 例: スタジオ一覧を取得
const response = await fetch(`${apiUrl}/api/studios`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
});
```

### POST リクエストの例

```javascript
// 例: ワークフローを作成
const response = await fetch(`${apiUrl}/api/workflows`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'My Workflow',
    description: 'Created from Chrome Extension',
    nodes: [],
    edges: [],
  }),
});
```

## 📖 利用可能な API エンドポイント

### ワークフロー

- `GET /api/workflows` - ワークフロー一覧取得
- `POST /api/workflows` - ワークフロー作成
- `PUT /api/workflows` - ワークフロー更新
- `DELETE /api/workflows?id=xxx` - ワークフロー削除
- `GET /api/workflows/[id]` - ワークフロー詳細取得

### スタジオ

- `GET /api/studios` - スタジオ一覧取得
- `POST /api/studios` - スタジオ作成
- `GET /api/studios/[id]` - スタジオ詳細取得
- `PUT /api/studios/[id]` - スタジオ更新
- `DELETE /api/studios/[id]` - スタジオ削除

### その他

詳細は `/docs/API_AUTHENTICATION.md` を参照してください。

## 🔐 セキュリティ

- **API キーを安全に保管**: Chrome Extension の `chrome.storage.local` に暗号化されて保存されます
- **HTTPS を使用**: 本番環境では必ず HTTPS でアクセスしてください
- **API キーの定期的なローテーション**: セキュリティのため、定期的に新しいキーを作成して古いキーを削除してください

## ⚠️ トラブルシューティング

### CORS エラーが発生する

`manifest.json` の `host_permissions` に API の URL が含まれていることを確認してください。

### 401 Unauthorized エラー

- API キーが正しいか確認
- API キーが有効か確認（`/settings/api-keys` で確認）
- Authorization ヘッダーの形式が `Bearer <api-key>` であることを確認

### ネットワークエラー

- API URL が正しいか確認
- kazika-studio のサーバーが起動しているか確認
- ブラウザの DevTools の Console でエラーメッセージを確認

## 📚 参考リンク

- [Chrome Extension 公式ドキュメント](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 マイグレーションガイド](https://developer.chrome.com/docs/extensions/migrating/to-service-workers/)
- [kazika-studio API ドキュメント](/docs/API_AUTHENTICATION.md)
