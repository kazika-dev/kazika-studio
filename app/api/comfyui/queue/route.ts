import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import { createComfyUIQueueItem, getComfyUIQueueItemsByUserId } from '@/lib/db';

/**
 * POST /api/comfyui/queue
 * ComfyUIワークフローをキューに追加
 */
export async function POST(request: NextRequest) {
  try {
    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { workflowName, workflowJson, prompt, inputImages, priority, metadata } = body;

    if (!workflowName) {
      return NextResponse.json(
        { error: 'workflowName is required' },
        { status: 400 }
      );
    }

    if (!workflowJson) {
      return NextResponse.json(
        { error: 'workflowJson is required' },
        { status: 400 }
      );
    }

    // 入力画像のGCPストレージパスを収集
    const imgPaths: string[] = [];
    if (inputImages && Array.isArray(inputImages)) {
      for (const img of inputImages) {
        if (img.storagePath) {
          imgPaths.push(img.storagePath);
        }
      }
    }

    // キューアイテムを作成
    const queueItem = await createComfyUIQueueItem({
      user_id: user.id,
      comfyui_workflow_name: workflowName,
      workflow_json: workflowJson,
      prompt: prompt || null,
      img_gcp_storage_paths: imgPaths,
      priority: priority || 0,
      metadata: metadata || {},
    });

    console.log('ComfyUI queue item created:', {
      id: queueItem.id,
      workflowName,
      userId: user.id,
      imageCount: imgPaths.length,
    });

    return NextResponse.json({
      success: true,
      queueItemId: queueItem.id,
      status: queueItem.status,
    });

  } catch (error: any) {
    console.error('Failed to create ComfyUI queue item:', error);
    return NextResponse.json(
      {
        error: 'Failed to create queue item',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/comfyui/queue
 * ユーザーのComfyUIキューアイテム一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const queueItems = await getComfyUIQueueItemsByUserId(user.id);

    return NextResponse.json({
      success: true,
      queueItems,
    });

  } catch (error: any) {
    console.error('Failed to get ComfyUI queue items:', error);
    return NextResponse.json(
      {
        error: 'Failed to get queue items',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
