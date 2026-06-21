import { Storage } from '@google-cloud/storage';
import crypto from 'node:crypto';

/**
 * GCP Storageクライアントのシングルトンインスタンス
 */
let storageClient: Storage | null = null;

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function normalizeStorageObjectPath(filePath: string): string {
  let path = String(filePath || '').trim();
  if (!path) return '';
  try {
    const parsed = new URL(path);
    if (parsed.hostname === 'storage.googleapis.com') {
      const bucketName = getStorageBucketName();
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts[0] === bucketName) {
        path = parts.slice(1).join('/');
      }
    }
  } catch {
    // Not a URL; keep treating it as an object path.
  }
  return path.replace(/^\/+/, '').replace(/^api\/storage\//, '').split('?')[0];
}

function getServiceAccountCredentials(): { client_email: string; private_key: string; project_id?: string } {
  const credentials = process.env.GCP_SERVICE_ACCOUNT_KEY;

  if (!credentials) {
    throw new Error('GCP_SERVICE_ACCOUNT_KEY environment variable is not set');
  }

  try {
    const credentialsJson = JSON.parse(credentials);
    if (!credentialsJson.client_email || !credentialsJson.private_key) {
      throw new Error('client_email/private_key is missing');
    }
    return credentialsJson;
  } catch (error) {
    throw new Error('Failed to parse GCP_SERVICE_ACCOUNT_KEY: ' + (error as Error).message);
  }
}

function createLocalV4ReadSignedUrl(filePath: string, expiresInSeconds = 300): string {
  const bucketName = getStorageBucketName();
  const objectPath = normalizeStorageObjectPath(filePath);
  const credentials = getServiceAccountCredentials();
  const now = new Date();
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const datestamp = iso.slice(0, 8);
  const credentialScope = `${datestamp}/auto/storage/goog4_request`;
  const host = 'storage.googleapis.com';
  const canonicalUri = `/${encodeRfc3986(bucketName)}/${objectPath.split('/').map(encodeRfc3986).join('/')}`;
  const queryParams: Record<string, string> = {
    'X-Goog-Algorithm': 'GOOG4-RSA-SHA256',
    'X-Goog-Credential': `${credentials.client_email}/${credentialScope}`,
    'X-Goog-Date': iso,
    'X-Goog-Expires': String(expiresInSeconds),
    'X-Goog-SignedHeaders': 'host',
  };
  const canonicalQueryString = Object.entries(queryParams)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join('&');
  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = ['GET', canonicalUri, canonicalQueryString, canonicalHeaders, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = ['GOOG4-RSA-SHA256', iso, credentialScope, hashedCanonicalRequest].join('\n');
  const signature = crypto.sign('RSA-SHA256', Buffer.from(stringToSign), credentials.private_key).toString('hex');

  return `https://${host}${canonicalUri}?${canonicalQueryString}&X-Goog-Signature=${signature}`;
}

export async function fetchFileFromStorageViaSignedUrl(filePath: string, rangeHeader?: string): Promise<{
  data: Buffer;
  contentType: string;
  size: number | null;
  contentRange: string | null;
  status: number;
}> {
  const signedUrl = createLocalV4ReadSignedUrl(filePath);
  const response = await fetch(signedUrl, rangeHeader ? { headers: { Range: rangeHeader } } : undefined);

  if (!response.ok) {
    throw new Error(`Signed storage fetch failed: ${response.status} ${response.statusText}`);
  }

  const data = Buffer.from(await response.arrayBuffer());
  const contentRange = response.headers.get('content-range');
  const rangeSize = contentRange?.match(/\/(\d+)$/)?.[1];
  const size = rangeSize ? Number(rangeSize) : Number(response.headers.get('content-length') || data.length);

  return {
    data,
    contentType: response.headers.get('content-type') || 'application/octet-stream',
    size: Number.isFinite(size) ? size : null,
    contentRange,
    status: response.status,
  };
}

export function getStorageBucketName(): string {
  const bucketName = process.env.GCP_STORAGE_BUCKET;

  if (!bucketName) {
    throw new Error('GCP_STORAGE_BUCKET environment variable is not set');
  }

  return bucketName;
}

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
  const bucketName = getStorageBucketName();

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
  const bucketName = getStorageBucketName();

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
  const objectPath = normalizeStorageObjectPath(filePath);

  try {
    const storage = getStorageClient();
    const bucketName = getStorageBucketName();

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectPath);

    // ファイルのメタデータを取得
    const [metadata] = await file.getMetadata();

    // ファイルデータをダウンロード
    const [data] = await file.download();

    return {
      data,
      contentType: metadata.contentType || 'application/octet-stream',
    };
  } catch (error) {
    console.warn('[gcp-storage] SDK download failed; falling back to local V4 signed URL fetch:', error instanceof Error ? error.message : String(error));
    const fallback = await fetchFileFromStorageViaSignedUrl(objectPath);
    return {
      data: fallback.data,
      contentType: fallback.contentType,
    };
  }
}

/**
 * 画像を削除
 * @param filePath ファイルパスまたはURL
 */
export async function deleteImageFromStorage(filePath: string): Promise<void> {
  const storage = getStorageClient();
  const bucketName = getStorageBucketName();

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

/**
 * 画像素材をGCP Storageにアップロード
 * @param fileBuffer 画像ファイルのBuffer
 * @param fileName ファイル名（例: "bg-school-001.png"）
 * @param mimeType ファイルのMIMEタイプ
 * @returns ファイルパス（例: "materials/bg-school-001.png"）
 */
export async function uploadImageMaterial(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const storage = getStorageClient();
  const bucketName = getStorageBucketName();

  const bucket = storage.bucket(bucketName);

  // ファイル名を生成（タイムスタンプ + 元のファイル名）
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const extension = fileName.split('.').pop() || 'png';
  const baseName = fileName.split('.').slice(0, -1).join('.').replace(/[^a-zA-Z0-9-_]/g, '-');
  const finalFileName = `${baseName}-${timestamp}-${randomStr}.${extension}`;

  const filePath = `materials/${finalFileName}`;
  console.log('[gcp-storage] Uploading image material to path:', filePath);

  const file = bucket.file(filePath);

  // ファイルをアップロード（非公開）
  await file.save(fileBuffer, {
    metadata: {
      contentType: mimeType,
      cacheControl: 'public, max-age=86400', // 24時間キャッシュ（マスタデータなので長めに設定）
    },
  });

  console.log('[gcp-storage] Image material upload completed successfully');

  return filePath;
}

/**
 * 画像素材をGCP Storageから削除
 * @param fileName ファイル名（例: "materials/bg-school-001.png"）
 */
export async function deleteImageMaterial(fileName: string): Promise<void> {
  return deleteImageFromStorage(fileName);
}

/**
 * 画像素材の署名付きURLを生成
 * @param fileName ファイル名（例: "materials/bg-school-001.png"）
 * @param expiresInMinutes 有効期限（分）デフォルト: 60分
 * @returns 署名付きURL
 */
export async function getImageMaterialSignedUrl(
  fileName: string,
  expiresInMinutes: number = 60
): Promise<string> {
  return getSignedUrl(fileName, expiresInMinutes);
}

/**
 * ファイルをBufferとしてダウンロード（getFileFromStorageのエイリアス）
 * @param filePath GCP Storage内のファイルパス
 * @returns ファイルデータ
 */
export async function downloadFileAsBuffer(filePath: string): Promise<Buffer> {
  const { data } = await getFileFromStorage(filePath);
  return data;
}

/**
 * テキストテンプレートのメディア（画像・動画）をGCP Storageにアップロード
 * @param fileBuffer ファイルのBuffer
 * @param fileName ファイル名
 * @param mimeType ファイルのMIMEタイプ
 * @param templateId テンプレートID
 * @returns ファイルパス
 */
export async function uploadTextTemplateMedia(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  templateId: number
): Promise<string> {
  const storage = getStorageClient();
  const bucketName = getStorageBucketName();

  const bucket = storage.bucket(bucketName);

  // ファイル名を生成（テンプレートID + タイムスタンプ + ランダム文字列）
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const extension = fileName.split('.').pop() || 'bin';
  const baseName = fileName.split('.').slice(0, -1).join('.').replace(/[^a-zA-Z0-9-_]/g, '-');
  const finalFileName = `${templateId}-${baseName}-${timestamp}-${randomStr}.${extension}`;

  // フォルダを決定（画像/動画で分ける）
  const folder = mimeType.startsWith('video/') ? 'text-template-media/videos' : 'text-template-media/images';
  const filePath = `${folder}/${finalFileName}`;
  console.log('[gcp-storage] Uploading text template media to path:', filePath);

  const file = bucket.file(filePath);

  // ファイルをアップロード（非公開）
  await file.save(fileBuffer, {
    metadata: {
      contentType: mimeType,
      cacheControl: 'public, max-age=86400', // 24時間キャッシュ
    },
  });

  console.log('[gcp-storage] Text template media upload completed successfully');

  return filePath;
}

/**
 * テキストテンプレートのメディアをGCP Storageから削除
 * @param fileName ファイル名
 */
export async function deleteTextTemplateMedia(fileName: string): Promise<void> {
  return deleteImageFromStorage(fileName);
}

/**
 * テキストテンプレートのメディアの署名付きURLを生成
 * @param fileName ファイル名
 * @param expiresInMinutes 有効期限（分）デフォルト: 120分
 * @returns 署名付きURL
 */
export async function getTextTemplateMediaSignedUrl(
  fileName: string,
  expiresInMinutes: number = 120
): Promise<string> {
  return getSignedUrl(fileName, expiresInMinutes);
}
