import { Storage } from '@google-cloud/storage';

/**
 * GCP Storageクライアントのシングルトンインスタンス
 */
let storageClient: Storage | null = null;

/**
 * GCP Storageクライアントを取得
 */
export function getStorageClient(): Storage {
  if (!storageClient) {
    // 環境変数から認証情報を取得
    const credentials = process.env.GCP_SERVICE_ACCOUNT_KEY;

    if (!credentials) {
      throw new Error('GCP_SERVICE_ACCOUNT_KEY environment variable is not set');
    }

    try {
      const credentialsJson = JSON.parse(credentials);
      storageClient = new Storage({
        credentials: credentialsJson,
        projectId: credentialsJson.project_id,
      });
    } catch (error) {
      throw new Error('Failed to parse GCP_SERVICE_ACCOUNT_KEY: ' + (error as Error).message);
    }
  }

  return storageClient;
}

/**
 * Base64画像をGCP Storageにアップロード
 * @param base64Data Base64エンコードされた画像データ
 * @param mimeType 画像のMIMEタイプ（例: 'image/png'）
 * @param fileName ファイル名（省略時は自動生成）
 * @returns 公開URL
 */
export async function uploadImageToStorage(
  base64Data: string,
  mimeType: string,
  fileName?: string
): Promise<string> {
  const storage = getStorageClient();
  const bucketName = process.env.GCP_STORAGE_BUCKET;

  if (!bucketName) {
    throw new Error('GCP_STORAGE_BUCKET environment variable is not set');
  }

  const bucket = storage.bucket(bucketName);

  // ファイル名を生成（タイムスタンプ + ランダム文字列）
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15);
  const extension = mimeType.split('/')[1] || 'png';
  const finalFileName = fileName || `nanobana-${timestamp}-${randomStr}.${extension}`;

  const file = bucket.file(`images/${finalFileName}`);

  // Base64をBufferに変換
  const buffer = Buffer.from(base64Data, 'base64');

  // ファイルをアップロード
  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000', // 1年間キャッシュ
    },
    // uniform bucket-level accessが有効な場合はpublic: trueは使えない
  });

  // ファイルを公開アクセス可能にする
  await file.makePublic();

  // 公開URLを生成
  const publicUrl = `https://storage.googleapis.com/${bucketName}/images/${finalFileName}`;

  return publicUrl;
}

/**
 * 画像を削除
 * @param fileUrl 画像の公開URL
 */
export async function deleteImageFromStorage(fileUrl: string): Promise<void> {
  const storage = getStorageClient();
  const bucketName = process.env.GCP_STORAGE_BUCKET;

  if (!bucketName) {
    throw new Error('GCP_STORAGE_BUCKET environment variable is not set');
  }

  // URLからファイルパスを抽出
  const urlPattern = new RegExp(`https://storage.googleapis.com/${bucketName}/(.+)`);
  const match = fileUrl.match(urlPattern);

  if (!match) {
    throw new Error('Invalid file URL format');
  }

  const filePath = match[1];
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(filePath);

  await file.delete();
}
