import { NextRequest, NextResponse } from 'next/server';
import { createKazikaClient } from '@/lib/kazika-db-client';
import { getFileFromStorage, getStorageBucketName, getStorageClient } from '@/lib/gcp-storage';

function parseRange(rangeHeader: string, size: number): { start: number; end: number } | null {
  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || size <= 0) return null;

  const [, rawStart, rawEnd] = match;

  if (!rawStart && !rawEnd) return null;

  // Suffix range: bytes=-500 means final 500 bytes.
  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    const start = Math.max(size - suffixLength, 0);
    return { start, end: size - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd ? Number(rawEnd) : size - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) {
    return null;
  }

  return { start, end: Math.min(end, size - 1) };
}

async function getFileRangeFromStorage(bucketName: string, filePath: string, start: number, end: number): Promise<{
  data: Buffer;
  contentType: string;
  size: number;
}> {
  const storage = getStorageClient();
  const file = storage.bucket(bucketName).file(filePath);
  const [metadata] = await file.getMetadata();

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    file
      .createReadStream({ start, end })
      .on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
      .on('error', reject)
      .on('end', resolve);
  });

  return {
    data: Buffer.concat(chunks),
    contentType: metadata.contentType || 'application/octet-stream',
    size: Number(metadata.size || 0),
  };
}

/**
 * 認証済みユーザーのみがアクセスできるストレージプロキシ
 * パス: /api/storage/images/output-xxx.png
 *
 * Cookie セッション認証と API キー認証の両方をサポート
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const db = await createKazikaClient();

    // 認証チェック
    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user) {
      console.error('[Storage Proxy] Authentication failed - no user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Storage Proxy] Authenticated user:', user.id, user.email);

    // paramsを解決
    const resolvedParams = await params;

    // ファイルパスを構築
    let filePath = resolvedParams.path.join('/');

    // Strip any accidentally included api/storage prefix from the path
    // This handles cases where the database has malformed paths like "api/storage/charactersheets/..."
    if (filePath.startsWith('api/storage/')) {
      console.log('[Storage Proxy] Stripping malformed api/storage prefix from path');
      filePath = filePath.replace('api/storage/', '');
    }

    console.log('[Storage Proxy] Fetching file:', filePath);

    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 });
    }

    // ファイルパスからoutput_idを推測してアクセス権限を確認
    // （オプション: より厳密な権限チェックが必要な場合）
    // const { data: output } = await db
    //   .from('workflow_outputs')
    //   .select('id, user_id')
    //   .eq('content_url', filePath)
    //   .single();
    //
    // if (!output || output.user_id !== user.id) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

    const rangeHeader = request.headers.get('range');

    // Video/audio elements commonly request byte ranges. Without 206 responses,
    // Safari/iOS and some Chromium cases fail to start playback from this proxy.
    if (rangeHeader) {
      const storage = getStorageClient();
      const bucketName = getStorageBucketName();
      const file = storage.bucket(bucketName).file(filePath);
      const [metadata] = await file.getMetadata();
      const size = Number(metadata.size || 0);
      const contentType = metadata.contentType || 'application/octet-stream';
      const parsedRange = parseRange(rangeHeader, size);

      if (!parsedRange) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${size}`,
            'Accept-Ranges': 'bytes',
          },
        });
      }

      const { start, end } = parsedRange;
      const { data } = await getFileRangeFromStorage(bucketName, filePath, start, end);
      console.log('Storage proxy: Range retrieved successfully, bucket:', bucketName, 'content-type:', contentType, 'range:', `${start}-${end}/${size}`, 'size:', data.length);

      return new NextResponse(new Uint8Array(data), {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'private, max-age=3600',
          'Accept-Ranges': 'bytes',
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Content-Length': data.length.toString(),
        },
      });
    }

    // GCPストレージからファイルを取得
    const { data, contentType } = await getFileFromStorage(filePath);
    console.log('Storage proxy: File retrieved successfully, content-type:', contentType, 'size:', data.length);

    // ファイルデータを返す（BufferをUint8Arrayに変換）
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600', // 1時間キャッシュ
        'Accept-Ranges': 'bytes',
        'Content-Length': data.length.toString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
    const stack = error instanceof Error ? error.stack : undefined;

    console.error('Storage proxy error:', {
      message,
      code,
      stack,
    });

    if (code === '404' || message.includes('No such object')) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch file',
        details: message,
        code,
      },
      { status: 500 }
    );
  }
}
