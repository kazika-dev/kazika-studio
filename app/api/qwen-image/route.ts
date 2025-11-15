import { NextRequest, NextResponse } from 'next/server';
import { createComfyUIQueueItem } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { prompt, referenceImages } = await request.json();

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    console.log('Qwen image generation request:', {
      promptLength: prompt.length,
      referenceImageCount: referenceImages?.length || 0,
    });

    // TODO: ユーザーIDを認証から取得（現在は仮の値）
    const userId = 'temp-user-id';

    // ComfyUIキューテーブルに追加
    // このノードがワークフローで最後になった場合に使用される
    const queueItem = await createComfyUIQueueItem({
      user_id: userId,
      comfyui_workflow_name: 'qwen_image',
      workflow_json: { prompt }, // Qwen固有の設定を保存
      prompt: prompt,
      img_gcp_storage_paths: referenceImages || [], // 参照画像のパスを保存
      priority: 0,
      metadata: {
        nodeType: 'qwen_image',
        createdAt: new Date().toISOString(),
      },
    });

    console.log('Queue item created:', queueItem.id);

    return NextResponse.json({
      success: true,
      queueItemId: queueItem.id,
    });

  } catch (error: any) {
    console.error('Qwen Image API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create queue item',
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
