import { NextRequest, NextResponse } from 'next/server';
import { uploadImageToStorage, deleteImageFromStorage } from '@/lib/gcp-storage';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import { query } from '@/lib/db';

// アウトプット一覧取得
export async function GET(request: NextRequest) {
  try {
    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // クエリパラメータ取得
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const outputType = searchParams.get('output_type');
    const workflowId = searchParams.get('workflow_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const offset = (page - 1) * limit;

    // source_url フィルタリング
    const sourceUrl = searchParams.get('source_url');
    const sourceUrlLike = searchParams.get('source_url_like');

    console.log('[GET /api/outputs] Query params:', { id, outputType, workflowId, sourceUrl, sourceUrlLike, limit, page, offset, userId: user.id });

    // 特定のIDで取得する場合
    if (id) {
      const result = await query(
        `SELECT id, user_id, workflow_id, output_type, content_url, content_text, prompt, metadata, source_url, favorite, created_at, updated_at
         FROM kazikastudio.workflow_outputs
         WHERE id = $1 AND user_id = $2`,
        [parseInt(id), user.id]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Output not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        outputs: result.rows, // 配列形式で返す（フロントエンドの互換性のため）
        pagination: {
          page: 1,
          limit: 1,
          total: 1,
          totalPages: 1,
        },
      });
    }

    // 動的にWHERE句を構築
    const conditions: string[] = ['user_id = $1'];
    const params: any[] = [user.id];
    let paramIndex = 2;

    if (outputType) {
      conditions.push(`output_type = $${paramIndex}`);
      params.push(outputType);
      paramIndex++;
    }

    if (workflowId) {
      conditions.push(`workflow_id = $${paramIndex}`);
      params.push(parseInt(workflowId));
      paramIndex++;
    }

    // source_url フィルタリング（完全一致）
    if (sourceUrl) {
      conditions.push(`source_url = $${paramIndex}`);
      params.push(sourceUrl);
      paramIndex++;
    }

    // source_url フィルタリング（部分一致）
    if (sourceUrlLike) {
      conditions.push(`source_url ILIKE $${paramIndex}`);
      params.push(`%${sourceUrlLike}%`);
      paramIndex++;
    }

    // お気に入りフィルタリング
    const favoriteOnly = searchParams.get('favorite_only');
    if (favoriteOnly === 'true') {
      conditions.push(`favorite = true`);
    }

    const whereClause = conditions.join(' AND ');

    // 総件数を取得
    const countResult = await query(
      `SELECT COUNT(*) as count FROM kazikastudio.workflow_outputs WHERE ${whereClause}`,
      params
    );

    const countRow = countResult.rows[0];
    console.log('[GET /api/outputs] Count result:', countRow);
    const total = Number(countRow?.count) || 0;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
    console.log('[GET /api/outputs] Calculated:', { total, totalPages, limit });

    // データを取得（ページネーション適用）
    const dataResult = await query(
      `SELECT id, user_id, workflow_id, output_type, content_url, content_text, prompt, metadata, source_url, favorite, created_at, updated_at
       FROM kazikastudio.workflow_outputs
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      success: true,
      outputs: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error: any) {
    console.error('Output fetch error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch outputs',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// アウトプット保存
export async function POST(request: NextRequest) {
  try {
    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workflowId, outputType, content, prompt, metadata } = body;

    // metadata から source_url を抽出（専用カラムに保存）
    const sourceUrl = (metadata?.source_url as string) || null;

    if (!outputType || !content) {
      return NextResponse.json(
        { error: 'outputType and content are required' },
        { status: 400 }
      );
    }

    // 出力タイプの検証
    const validTypes = ['image', 'video', 'audio', 'text', 'file', 'json'];
    if (!validTypes.includes(outputType)) {
      return NextResponse.json(
        { error: `Invalid outputType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    let contentUrl: string | null = null;
    let contentText: string | null = null;

    // タイプに応じて処理を分岐
    if (outputType === 'image' || outputType === 'video' || outputType === 'audio' || outputType === 'file') {
      // ファイル系の場合
      // 既にアップロード済みのパスがある場合はそれを使用
      if (content.path && typeof content.path === 'string') {
        contentUrl = content.path; // GCP Storage内部パス
      }
      // 既にアップロード済みのURLがある場合（後方互換性）
      else if (content.url && typeof content.url === 'string') {
        contentUrl = content.url;
      }
      // base64データがある場合はGCPストレージにアップロード
      else if (content.base64 && content.mimeType) {
        try {
          contentUrl = await uploadImageToStorage(
            content.base64,
            content.mimeType,
            content.fileName
          );
        } catch (uploadError: any) {
          console.error('GCP upload error:', uploadError);
          return NextResponse.json(
            { error: 'Failed to upload to storage', details: uploadError.message },
            { status: 500 }
          );
        }
      }
      // どれもない場合はエラー
      else {
        return NextResponse.json(
          { error: 'For file types, content must include either path, url, or (base64 and mimeType)' },
          { status: 400 }
        );
      }
    } else if (outputType === 'text') {
      // テキストの場合、直接保存
      contentText = content;
    }

    // DBに保存（直接クエリを使用）
    const result = await query(
      `INSERT INTO kazikastudio.workflow_outputs
       (user_id, workflow_id, output_type, content_url, content_text, prompt, metadata, favorite, source_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, workflow_id, output_type, content_url, content_text, prompt, metadata, favorite, source_url, created_at, updated_at`,
      [
        user.id,
        workflowId || null,
        outputType,
        contentUrl,
        contentText,
        prompt || null,
        JSON.stringify(metadata || {}),
        false,
        sourceUrl
      ]
    );

    if (result.rows.length === 0) {
      // アップロードしたファイルがある場合は削除
      if (contentUrl) {
        try {
          await deleteImageFromStorage(contentUrl);
        } catch (deleteError) {
          console.error('Failed to cleanup uploaded file:', deleteError);
        }
      }
      throw new Error('Failed to insert output');
    }

    return NextResponse.json({
      success: true,
      output: result.rows[0],
    });
  } catch (error: any) {
    console.error('Output save error:', error);
    return NextResponse.json(
      {
        error: 'Failed to save output',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// アウトプット削除
export async function DELETE(request: NextRequest) {
  try {
    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // 削除前にアウトプット情報を取得（GCPから削除するため、所有者確認も兼ねる）
    const fetchResult = await query(
      `SELECT id, output_type, content_url
       FROM kazikastudio.workflow_outputs
       WHERE id = $1 AND user_id = $2`,
      [parseInt(id), user.id]
    );

    if (fetchResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Output not found' },
        { status: 404 }
      );
    }

    const output = fetchResult.rows[0];

    // DBから削除
    await query(
      `DELETE FROM kazikastudio.workflow_outputs WHERE id = $1 AND user_id = $2`,
      [parseInt(id), user.id]
    );

    // GCPストレージからも削除（ファイル系の場合のみ）
    if (output.content_url && ['image', 'video', 'audio', 'file'].includes(output.output_type)) {
      try {
        await deleteImageFromStorage(output.content_url);
      } catch (storageError) {
        console.error('Failed to delete from GCP storage:', storageError);
        // ストレージ削除失敗はログのみで、エラーにはしない
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Output deleted successfully',
    });
  } catch (error: any) {
    console.error('Output delete error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete output',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
