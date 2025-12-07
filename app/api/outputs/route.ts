import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadImageToStorage, deleteImageFromStorage } from '@/lib/gcp-storage';
import { authenticateRequest } from '@/lib/auth/apiAuth';

// アウトプット一覧取得
export async function GET(request: NextRequest) {
  try {
    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Supabaseクライアントを取得（RLSを適用するため）
    const supabase = await createClient();

    // クエリパラメータ取得
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const outputType = searchParams.get('output_type');
    const workflowId = searchParams.get('workflow_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const offset = (page - 1) * limit;

    // 特定のIDで取得する場合
    if (id) {
      const { data, error } = await supabase
        .from('workflow_outputs')
        .select('id, user_id, workflow_id, output_type, content_url, content_text, prompt, metadata, created_at, updated_at')
        .eq('id', parseInt(id))
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json(
            { success: false, error: 'Output not found' },
            { status: 404 }
          );
        }
        throw error;
      }

      return NextResponse.json({
        success: true,
        outputs: [data], // 配列形式で返す（フロントエンドの互換性のため）
        pagination: {
          page: 1,
          limit: 1,
          total: 1,
          totalPages: 1,
        },
      });
    }

    // 総件数取得用のクエリを構築
    let countQuery = supabase
      .from('workflow_outputs')
      .select('id', { count: 'exact', head: true });

    if (outputType) {
      countQuery = countQuery.eq('output_type', outputType);
    }

    if (workflowId) {
      countQuery = countQuery.eq('workflow_id', parseInt(workflowId));
    }

    // 総件数を取得
    const { count, error: countError } = await countQuery;

    if (countError) {
      throw countError;
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    // データ取得用のクエリを構築
    let query = supabase
      .from('workflow_outputs')
      .select('id, user_id, workflow_id, output_type, content_url, content_text, prompt, metadata, created_at, updated_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (outputType) {
      query = query.eq('output_type', outputType);
    }

    if (workflowId) {
      query = query.eq('workflow_id', parseInt(workflowId));
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      outputs: data,
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

    // Supabaseクライアントを取得（RLSを適用するため）
    const supabase = await createClient();

    const body = await request.json();
    const { workflowId, outputType, content, prompt, metadata } = body;

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

    // DBに保存
    const insertData: any = {
      user_id: user.id,
      output_type: outputType,
      prompt: prompt || null,
      metadata: metadata || {},
      favorite: false,
    };

    if (workflowId) {
      insertData.workflow_id = workflowId;
    }

    if (contentUrl) {
      insertData.content_url = contentUrl;
    }

    if (contentText) {
      insertData.content_text = contentText;
    }

    const { data, error } = await supabase
      .from('workflow_outputs')
      .insert(insertData)
      .select('id, workflow_id, output_type, content_url, content_text, prompt, metadata, favorite, created_at, updated_at')
      .single();

    if (error) {
      // アップロードしたファイルがある場合は削除
      if (contentUrl) {
        try {
          await deleteImageFromStorage(contentUrl);
        } catch (deleteError) {
          console.error('Failed to cleanup uploaded file:', deleteError);
        }
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      output: data,
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

    // Supabaseクライアントを取得（RLSを適用するため）
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // 削除前にアウトプット情報を取得（GCPから削除するため）
    const { data: output, error: fetchError } = await supabase
      .from('workflow_outputs')
      .select('id, output_type, content_url')
      .eq('id', parseInt(id))
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Output not found' },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    // DBから削除
    const { error: deleteError } = await supabase
      .from('workflow_outputs')
      .delete()
      .eq('id', parseInt(id));

    if (deleteError) {
      throw deleteError;
    }

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
