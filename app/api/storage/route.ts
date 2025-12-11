import { NextRequest, NextResponse } from 'next/server';
import { getFileFromStorage } from '@/lib/gcp-storage';

/**
 * GET /api/storage
 * GCP Storageファイルを直接返す（認証不要）
 *
 * クエリパラメータ:
 * - path: ファイルパス（必須）例: "images/output-xxx.png", "videos/video-xxx.mp4"
 *
 * レスポンス:
 * - ファイルのバイナリデータ（Content-Type付き）
 */
export async function GET(request: NextRequest) {
  try {
    // クエリパラメータを取得
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

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

    // GCP Storageからファイルを取得
    const { data, contentType } = await getFileFromStorage(path.trim());

    // ファイルを直接返す
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // 1時間キャッシュ
      },
    });
  } catch (error: any) {
    console.error('[api/storage] Failed to get file:', error);

    // ファイルが存在しない場合
    if (error.code === 404 || error.message?.includes('No such object')) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to get file', details: error.message },
      { status: 500 }
    );
  }
}
