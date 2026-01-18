# Storage API 詳細リファレンス

## `/lib/gcp-storage.ts` 関数一覧

| 関数名 | 引数 | 戻り値 | 用途 |
|--------|------|--------|------|
| `uploadImageToStorage` | `(base64Data, mimeType, fileName?, customFolder?)` | `Promise<string>` | Base64データをアップロード |
| `getFileFromStorage` | `(filePath)` | `Promise<{data: Buffer, contentType: string}>` | ファイル取得 |
| `downloadFileAsBuffer` | `(filePath)` | `Promise<Buffer>` | Bufferのみ取得 |
| `deleteImageFromStorage` | `(filePath)` | `Promise<void>` | ファイル削除 |
| `uploadImageMaterial` | `(fileBuffer, fileName, mimeType)` | `Promise<string>` | 素材アップロード |
| `deleteImageMaterial` | `(fileName)` | `Promise<void>` | 素材削除 |

## ストレージパス形式

```
{folder}/{baseName}-{timestamp}-{randomStr}.{extension}
```

例: `images/output-1705123456789-abc123def.png`

## フォルダ構成

| フォルダ | 用途 |
|----------|------|
| `images/` | 生成画像 |
| `videos/` | 生成動画 |
| `audio/` | 生成音声 |
| `materials/` | 画像素材マスタ |
| `charactersheets/` | キャラクターシート |
| `files/` | その他 |

## エラーハンドリング

```typescript
try {
  const { data, contentType } = await getFileFromStorage(path);
} catch (error: any) {
  if (error.code === 404 || error.message?.includes('No such object')) {
    // ファイルが存在しない
  }
}
```

## 認証フロー（Storage Proxy）

1. Cookie または `Authorization: Bearer <api-key>` で認証
2. `authenticateRequest()` でユーザー検証
3. GCP Storage からファイル取得
4. `Content-Type` ヘッダー付きでレスポンス
