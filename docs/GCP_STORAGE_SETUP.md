# GCP Storage セットアップガイド

このガイドでは、Nanobananaノードで生成された画像をGoogle Cloud Storage (GCS) に保存するための設定方法を説明します。

## 前提条件

- Google Cloud Platform (GCP) アカウント
- GCP プロジェクト

## セットアップ手順

### 1. GCP Storage バケットの作成

1. [GCP Console](https://console.cloud.google.com/) にログイン
2. 「Cloud Storage」→「バケット」に移動
3. 「バケットを作成」をクリック
4. 以下の設定でバケットを作成：
   - **名前**: 任意のバケット名（例: `kazika-studio-images`）
   - **ロケーションタイプ**: Region（推奨）
   - **リージョン**: `asia-northeast1` (東京)
   - **ストレージクラス**: Standard
   - **アクセス制御**: 均一（バケットレベルの権限）
   - **公開アクセス**: 「公開アクセスを防ぐ」のチェックを外す

### 2. バケットの公開設定

1. 作成したバケットを選択
2. 「権限」タブに移動
3. 「アクセス権を付与」をクリック
4. 以下を追加：
   - **新しいプリンシパル**: `allUsers`
   - **ロール**: Storage オブジェクト閲覧者 (Storage Object Viewer)
5. 「保存」をクリック

### 3. サービスアカウントの作成

1. GCP Console で「IAM と管理」→「サービスアカウント」に移動
2. 「サービスアカウントを作成」をクリック
3. 以下の情報を入力：
   - **サービスアカウント名**: `kazika-studio-storage`
   - **説明**: Storage upload for Kazika Studio
4. 「作成して続行」をクリック
5. ロールを付与：
   - **ロール**: Storage オブジェクト作成者 (Storage Object Creator)
6. 「完了」をクリック

### 4. サービスアカウントキーの生成

1. 作成したサービスアカウントをクリック
2. 「キー」タブに移動
3. 「鍵を追加」→「新しい鍵を作成」をクリック
4. キーのタイプ: **JSON** を選択
5. 「作成」をクリック
6. JSONファイルがダウンロードされます

### 5. 環境変数の設定

1. プロジェクトのルートディレクトリに `.env.local` ファイルを作成（または既存のものを編集）
2. ダウンロードしたJSONファイルの内容をコピー
3. 改行を削除してミニファイ（1行に）
4. 以下の環境変数を設定：

```bash
# GCP Storage Configuration
GCP_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project-id",...}
GCP_STORAGE_BUCKET=your-bucket-name
```

**注意**: `GCP_SERVICE_ACCOUNT_KEY` は完全なJSON文字列を改行なしで1行に記述してください。

### 6. 動作確認

1. 開発サーバーを再起動：
   ```bash
   npm run dev
   ```

2. Nanobananaノードで画像を生成
3. 実行パネルで「GCP Storage URL」が表示されることを確認
4. URLをクリックして画像が表示されることを確認

## トラブルシューティング

### エラー: "GCP_SERVICE_ACCOUNT_KEY environment variable is not set"

- `.env.local` ファイルに `GCP_SERVICE_ACCOUNT_KEY` が設定されているか確認
- サーバーを再起動したか確認

### エラー: "Failed to parse GCP_SERVICE_ACCOUNT_KEY"

- JSON文字列が正しい形式か確認
- 改行が含まれていないか確認
- ダブルクォートがエスケープされているか確認

### エラー: "Permission denied"

- サービスアカウントに「Storage オブジェクト作成者」ロールが付与されているか確認
- バケット名が正しいか確認

### 画像がアップロードされるがURLにアクセスできない

- バケットが公開設定されているか確認
- `allUsers` に「Storage オブジェクト閲覧者」ロールが付与されているか確認

## セキュリティに関する注意

- サービスアカウントキー（JSON）は機密情報です。Gitにコミットしないでください
- `.env.local` は `.gitignore` に含まれていることを確認してください
- 本番環境では環境変数を安全に管理してください（Vercel Secrets等）

## コスト

- Cloud Storage の料金は使用量に応じて変動します
- 東京リージョンの標準ストレージ: 約 $0.020/GB/月
- ネットワーク送信料金: アジア地域へは無料（同一リージョン内）
- 詳細: https://cloud.google.com/storage/pricing

## その他

画像の自動削除やライフサイクル管理が必要な場合は、GCS のライフサイクルルールを設定することをお勧めします。
