import { NextRequest, NextResponse } from 'next/server';
import { getSignedUrl } from '@/lib/gcp-storage';
import { authenticateRequest } from '@/lib/auth/apiAuth';

/**
 * GET /api/storage
 * GCP Storageファイルの署名付きURL（一時的な公開URL）を生成
 *
 * クエリパラメータ:
 * - path: ファイルパス（必須）例: "images/output-xxx.png", "videos/video-xxx.mp4"
 * - expires: 有効期限（分）（オプション、デフォルト: 30分、最大: 1440分=24時間）
 *
 * レスポンス:
 * {
 *   success: true,
 *   url: "https://storage.googleapis.com/...",
 *   expiresAt: "2025-12-11T12:34:56.789Z",
 *   expiresInMinutes: 30
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // 認証チェック（Cookie、APIキー、JWT認証をサポート）
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // クエリパラメータを取得
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    const expiresParam = searchParams.get('expires');

    // バリデーション: pathは必須
    if (!path || !path.trim()) {
      return NextResponse.json(
        { error: 'path parameter is required' },
        { status: 400 }
      );
    }

    // パスのバリデーション（ディレクトリトラバーサル攻撃対策）
    if (path.includes('..') || path.startsWith('/')) {
      return NextResponse.json(
        { error: 'Invalid path format' },
        { status: 400 }
      );
    }

    // 有効期限の処理（デフォルト: 30分、最大: 1440分=24時間）
    let expiresInMinutes = 30;
    if (expiresParam) {
      const parsed = parseInt(expiresParam, 10);
      if (isNaN(parsed) || parsed < 1) {
        return NextResponse.json(
          { error: 'expires must be a positive integer' },
          { status: 400 }
        );
      }
      // 最大24時間に制限
      expiresInMinutes = Math.min(parsed, 1440);
    }

    // 署名付きURLを生成
    const signedUrl = await getSignedUrl(path.trim(), expiresInMinutes);

    // 有効期限の日時を計算
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    return NextResponse.json({
      success: true,
      url: signedUrl,
      expiresAt: expiresAt.toISOString(),
      expiresInMinutes,
    });
  } catch (error: any) {
    console.error('[api/storage] Failed to generate signed URL:', error);

    // ファイルが存在しない場合
    if (error.code === 404 || error.message?.includes('No such object')) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate signed URL', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/storage
 * 複数ファイルの署名付きURLを一括生成
 *
 * リクエストボディ:
 * {
 *   paths: ["images/output-1.png", "videos/video-1.mp4"],
 *   expires: 30  // オプション、デフォルト: 30分
 * }
 *
 * レスポンス:
 * {
 *   success: true,
 *   urls: [
 *     { path: "images/output-1.png", url: "https://...", expiresAt: "..." },
 *     { path: "videos/video-1.mp4", url: "https://...", expiresAt: "..." }
 *   ],
 *   expiresInMinutes: 30
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { paths, expires } = body;

    // バリデーション: pathsは配列で必須
    if (!Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json(
        { error: 'paths must be a non-empty array' },
        { status: 400 }
      );
    }

    // 最大50件に制限
    if (paths.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 paths allowed per request' },
        { status: 400 }
      );
    }

    // 有効期限の処理（デフォルト: 30分）
    let expiresInMinutes = 30;
    if (expires !== undefined) {
      const parsed = parseInt(expires, 10);
      if (isNaN(parsed) || parsed < 1) {
        return NextResponse.json(
          { error: 'expires must be a positive integer' },
          { status: 400 }
        );
      }
      expiresInMinutes = Math.min(parsed, 1440);
    }

    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    // 各パスの署名付きURLを生成
    const results = await Promise.all(
      paths.map(async (path: string) => {
        // パスのバリデーション
        if (!path || typeof path !== 'string' || path.includes('..') || path.startsWith('/')) {
          return {
            path,
            error: 'Invalid path format',
          };
        }

        try {
          const url = await getSignedUrl(path.trim(), expiresInMinutes);
          return {
            path: path.trim(),
            url,
            expiresAt: expiresAt.toISOString(),
          };
        } catch (error: any) {
          return {
            path,
            error: error.message || 'Failed to generate URL',
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      urls: results,
      expiresInMinutes,
    });
  } catch (error: any) {
    console.error('[api/storage] Failed to generate signed URLs:', error);
    return NextResponse.json(
      { error: 'Failed to generate signed URLs', details: error.message },
      { status: 500 }
    );
  }
}
