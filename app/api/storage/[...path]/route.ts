import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFileFromStorage } from '@/lib/gcp-storage';

/**
 * 認証済みユーザーのみがアクセスできるストレージプロキシ
 * パス: /api/storage/images/output-xxx.png
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error('Storage proxy: Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // paramsを解決
    const resolvedParams = await params;

    // ファイルパスを構築
    const filePath = resolvedParams.path.join('/');
    console.log('Storage proxy: Fetching file:', filePath);

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
