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
 * Base64ファイルをGCP Storageにアップロード
 * @param base64Data Base64エンコードされたファイルデータ
 * @param mimeType ファイルのMIMEタイプ（例: 'image/png', 'video/mp4', 'audio/mpeg'）
 * @param fileName ファイル名（省略時は自動生成）
 * @param customFolder カスタムフォルダ名（省略時はMIMEタイプから自動判定）
 * @returns ファイルパス
 */
export async function uploadImageToStorage(
  base64Data: string,
  mimeType: string,
  fileName?: string,
  customFolder?: string
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
  const extension = mimeType.split('/')[1] || 'bin';
  const finalFileName = fileName || `output-${timestamp}-${randomStr}.${extension}`;

  // フォルダを決定
  let folder: string;
  if (customFolder) {
    // カスタムフォルダが指定されている場合はそれを使用
    folder = customFolder;
    console.log('[gcp-storage] Using custom folder:', folder);
  } else {
    // MIMEタイプに応じてフォルダを分ける
    folder = 'files';
    if (mimeType.startsWith('image/')) {
      folder = 'images';
    } else if (mimeType.startsWith('video/')) {
      folder = 'videos';
    } else if (mimeType.startsWith('audio/')) {
      folder = 'audio';
    }
    console.log('[gcp-storage] Auto-detected folder from MIME type:', folder);
  }

  const filePath = `${folder}/${finalFileName}`;
  console.log('[gcp-storage] Uploading to path:', filePath);

  const file = bucket.file(filePath);

  // Base64をBufferに変換
  const buffer = Buffer.from(base64Data, 'base64');

  // ファイルをアップロード（非公開）
  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
      cacheControl: 'private, max-age=3600', // 1時間キャッシュ
    },
  });

  console.log('[gcp-storage] Upload completed successfully');

  // ファイルパスを返す（公開URLではなく内部パス）
  return filePath;
}

/**
 * ファイルの署名付きURLを生成（認証済みアクセス用）
 * @param filePath GCP Storage内のファイルパス（例: "images/output-xxx.png"）
 * @param expiresInMinutes 有効期限（分）デフォルト: 60分
 * @returns 署名付きURL
 */
export async function getSignedUrl(
  filePath: string,
  expiresInMinutes: number = 60
): Promise<string> {
  const storage = getStorageClient();
  const bucketName = process.env.GCP_STORAGE_BUCKET;

  if (!bucketName) {
    throw new Error('GCP_STORAGE_BUCKET environment variable is not set');
  }

  const bucket = storage.bucket(bucketName);
  const file = bucket.file(filePath);

  // 署名付きURLを生成
  const [signedUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiresInMinutes * 60 * 1000,
  });

  return signedUrl;
}

/**
 * GCP Storageからファイルデータを取得
 * @param filePath GCP Storage内のファイルパス
 * @returns ファイルデータとメタデータ
 */
export async function getFileFromStorage(filePath: string): Promise<{
  data: Buffer;
  contentType: string;
}> {
  const storage = getStorageClient();
  const bucketName = process.env.GCP_STORAGE_BUCKET;

  if (!bucketName) {
    throw new Error('GCP_STORAGE_BUCKET environment variable is not set');
  }

  const bucket = storage.bucket(bucketName);
  const file = bucket.file(filePath);

  // ファイルのメタデータを取得
  const [metadata] = await file.getMetadata();

  // ファイルデータをダウンロード
  const [data] = await file.download();

  return {
    data,
    contentType: metadata.contentType || 'application/octet-stream',
  };
}

/**
 * 画像を削除
 * @param filePath ファイルパスまたはURL
 */
export async function deleteImageFromStorage(filePath: string): Promise<void> {
  const storage = getStorageClient();
  const bucketName = process.env.GCP_STORAGE_BUCKET;

  if (!bucketName) {
    throw new Error('GCP_STORAGE_BUCKET environment variable is not set');
  }

  // URLの場合はファイルパスを抽出
  let path = filePath;
  const urlPattern = new RegExp(`https://storage.googleapis.com/${bucketName}/(.+)`);
  const match = filePath.match(urlPattern);

  if (match) {
    path = match[1];
  }

  // 署名付きURLの場合（?で始まるクエリパラメータを削除）
  path = path.split('?')[0];

  const bucket = storage.bucket(bucketName);
  const file = bucket.file(path);

  await file.delete();
}
