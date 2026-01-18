---
name: storage-api
description: GCP Storage を使った画像・動画・音声ファイルのアップロード・ダウンロード機能。このスキルは画像のアップロード、ダウンロード、削除などのストレージ操作が必要な場合に使用する。
user-invocable: true
---

# Storage API スキル

GCP Storage を使ったファイル操作の実装ガイド。

## コア関数 (`/lib/gcp-storage.ts`)

### アップロード

```typescript
import { uploadImageToStorage } from '@/lib/gcp-storage';

// Base64データをアップロード
const filePath = await uploadImageToStorage(
  base64Data,           // Base64エンコードされたデータ
  'image/png',          // MIMEタイプ
  'custom-name.png',    // ファイル名（省略可、自動生成）
  'custom-folder'       // フォルダ名（省略可、MIMEタイプから自動判定）
);
// 戻り値: "images/output-1234567890-abc123.png"
```

**フォルダ自動判定**:
- `image/*` → `images/`
- `video/*` → `videos/`
- `audio/*` → `audio/`
- その他 → `files/`

### ダウンロード

```typescript
import { getFileFromStorage, downloadFileAsBuffer } from '@/lib/gcp-storage';

// ファイルデータとメタデータを取得
const { data, contentType } = await getFileFromStorage('images/output-xxx.png');

// Bufferのみ取得（エイリアス）
const buffer = await downloadFileAsBuffer('images/output-xxx.png');
```

### 削除

```typescript
import { deleteImageFromStorage } from '@/lib/gcp-storage';

await deleteImageFromStorage('images/output-xxx.png');
```

## API エンドポイント

### GET `/api/storage/[...path]`

認証済みユーザーのみがアクセスできるストレージプロキシ。

```typescript
// フロントエンドから
const response = await fetch('/api/storage/images/output-xxx.png');
const blob = await response.blob();
```

**認証方式**:
- Cookie セッション認証
- Authorization ヘッダー（`Bearer <api-key>`）

**レスポンスヘッダー**:
- `Content-Type`: ファイルのMIMEタイプ
- `Cache-Control`: `private, max-age=3600`

## 画像素材専用関数

```typescript
import { uploadImageMaterial, deleteImageMaterial } from '@/lib/gcp-storage';

// 画像素材をアップロード（materials/ フォルダに保存）
const filePath = await uploadImageMaterial(
  fileBuffer,    // Buffer
  'bg-001.png',  // ファイル名
  'image/png'    // MIMEタイプ
);
// 戻り値: "materials/bg-001-1234567890-abc123.png"
```

## 環境変数

```env
GCP_SERVICE_ACCOUNT_KEY={"type":"service_account",...}  # JSON形式
GCP_STORAGE_BUCKET=your-bucket-name
```

## 使用例

### ワークフローでの画像保存

```typescript
import { uploadImageToStorage } from '@/lib/gcp-storage';

const base64Image = 'iVBORw0KGgo...';
const storagePath = await uploadImageToStorage(base64Image, 'image/png');

// DBに保存
await createWorkflowOutput({
  workflow_id,
  output_type: 'image',
  content_url: storagePath,
  metadata: { nodeId, width, height }
});
```

### フロントエンドでの画像表示

```tsx
// 認証付きプロキシ経由
<img src={`/api/storage/${storagePath}`} alt="Generated" />
```

## 詳細リファレンス

関数一覧・フォルダ構成・エラーハンドリングの詳細は [references/api-details.md](references/api-details.md) を参照。
