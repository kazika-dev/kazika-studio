import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadImageToStorage } from '@/lib/gcp-storage';
import { authenticateRequest } from '@/lib/auth/apiAuth';

export async function POST(request: NextRequest) {
  try {
    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const originalOutputId = formData.get('originalOutputId') as string | null;
    const customPrompt = formData.get('prompt') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // ファイルをBase64に変換
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');

    // GCP Storageにアップロード
    const fileName = `edited-${Date.now()}.png`;
    const contentUrl = await uploadImageToStorage(base64Data, 'image/png', fileName);

    // メタデータの準備
    const metadata: any = {
      editedAt: new Date().toISOString(),
      fileSize: file.size,
    };

    // 元のアウトプット情報を取得
    let prompt = customPrompt || 'Edited image';
    let workflowId = null;

    if (originalOutputId) {
      const { data: originalOutput } = await supabase
        .from('workflow_outputs')
        .select('prompt, workflow_id, metadata')
        .eq('id', originalOutputId)
        .single();

      if (originalOutput) {
        // customPromptがない場合のみ、元のプロンプトを使用
        if (!customPrompt) {
          prompt = `Edited: ${originalOutput.prompt || 'image'}`;
        }
        workflowId = originalOutput.workflow_id;
        metadata.originalOutputId = originalOutputId;
        metadata.originalMetadata = originalOutput.metadata;
      }
    }

    // workflow_outputsテーブルに保存
    const { data: newOutput, error: insertError } = await supabase
      .from('workflow_outputs')
      .insert({
        user_id: user.id,
        workflow_id: workflowId,
        output_type: 'image',
        content_url: contentUrl,
        prompt,
        metadata,
        favorite: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert output:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to save output' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      output: newOutput,
    });
  } catch (error) {
    console.error('Error saving edited image:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
