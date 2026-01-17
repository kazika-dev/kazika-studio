import { NextRequest, NextResponse } from 'next/server';
import { getFileFromStorage } from '@/lib/gcp-storage';
import { authenticateRequest } from '@/lib/auth/apiAuth';

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
    // Cookie または Authorization ヘッダーで認証
    console.log('[Storage Proxy] Authenticating request for:', request.url);
    console.log('[Storage Proxy] Authorization header:', request.headers.get('authorization') ? 'Present' : 'None');
    console.log('[Storage Proxy] Cookies:', request.headers.get('cookie') ? 'Present' : 'None');

    const user = await authenticateRequest(request);

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
    // const { data: output } = await supabase
    //   .from('workflow_outputs')
    //   .select('id, user_id')
    //   .eq('content_url', filePath)
    //   .single();
    //
    // if (!output || output.user_id !== user.id) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

    // GCPストレージからファイルを取得
    const { data, contentType } = await getFileFromStorage(filePath);
    console.log('Storage proxy: File retrieved successfully, content-type:', contentType, 'size:', data.length);

    // ファイルデータを返す（BufferをUint8Arrayに変換）
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600', // 1時間キャッシュ
        'Content-Length': data.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Storage proxy error:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    if (error.code === 404 || error.message?.includes('No such object')) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch file',
        details: error.message,
        code: error.code,
      },
      { status: 500 }
    );
  }
}
