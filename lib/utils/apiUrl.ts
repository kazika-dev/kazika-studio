/**
 * API URLを取得するヘルパー関数
 * クライアントサイドでは相対URL、サーバーサイドでは絶対URLを返す
 */
export function getApiUrl(path: string): string {
  // クライアントサイドでは相対URLを使用
  if (typeof window !== 'undefined') {
    return path;
  }

  // サーバーサイドでは絶対URLを構築
  let baseUrl: string;
  if (process.env.NEXT_PUBLIC_APP_URL) {
    baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  } else if (process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`;
  } else {
    baseUrl = 'http://localhost:3000';
  }

  return `${baseUrl}${path}`;
}
