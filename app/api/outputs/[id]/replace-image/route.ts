import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadImageToStorage, deleteImageFromStorage } from '@/lib/gcp-storage';

/**
 * 既存のoutputの画像を差し替える（上書き保存）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const outputId = parseInt(id, 10);
    if (isNaN(outputId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid output ID' },
        { status: 400 }
      );
    }

    // 既存のoutputを取得
    const { data: existingOutput, error: fetchError } = await supabase
      .from('workflow_outputs')
      .select('*')
      .eq('id', outputId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingOutput) {
      return NextResponse.json(
        { success: false, error: 'Output not found or access denied' },
        { status: 404 }
      );
    }

    if (existingOutput.output_type !== 'image') {
      return NextResponse.json(
        { success: false, error: 'This output is not an image' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // 古い画像をGCP Storageから削除
    if (existingOutput.content_url) {
      try {
        await deleteImageFromStorage(existingOutput.content_url);
      } catch (deleteError) {
        console.error('Failed to delete old image:', deleteError);
        // 削除失敗してもエラーにはしない
      }
    }

    // 新しい画像をBase64に変換
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');

    // GCP Storageにアップロード
    const fileName = `edited-${Date.now()}.png`;
    const contentUrl = await uploadImageToStorage(base64Data, 'image/png', fileName);

    // メタデータを更新
    const metadata = {
      ...(existingOutput.metadata || {}),
      editedAt: new Date().toISOString(),
      fileSize: file.size,
      previousContentUrl: existingOutput.content_url,
    };

    // DBを更新
    const { data: updatedOutput, error: updateError } = await supabase
      .from('workflow_outputs')
      .update({
        content_url: contentUrl,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', outputId)
      .select()
      .single();

    if (updateError) {
      // アップロードした画像を削除
      try {
        await deleteImageFromStorage(contentUrl);
      } catch (cleanupError) {
        console.error('Failed to cleanup uploaded file:', cleanupError);
      }
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      output: updatedOutput,
    });
  } catch (error) {
    console.error('Error replacing image:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
