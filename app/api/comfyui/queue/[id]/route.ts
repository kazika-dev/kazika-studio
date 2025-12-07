import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import { getComfyUIQueueItemById } from '@/lib/db';

/**
 * GET /api/comfyui/queue/[id]
 * ComfyUIキューアイテムの状態を取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const queueItemId = parseInt(id);

    if (isNaN(queueItemId)) {
      return NextResponse.json(
        { error: 'Invalid queue item ID' },
        { status: 400 }
      );
    }

    const queueItem = await getComfyUIQueueItemById(queueItemId);

    if (!queueItem) {
      return NextResponse.json(
        { error: 'Queue item not found' },
        { status: 404 }
      );
    }

    // 所有者確認
    if (queueItem.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 出力画像をbase64形式に変換（もしGCPストレージパスがある場合）
    let outputImages = null;
    if (queueItem.status === 'completed' && queueItem.output_gcp_storage_paths) {
      const paths = Array.isArray(queueItem.output_gcp_storage_paths)
        ? queueItem.output_gcp_storage_paths
        : JSON.parse(queueItem.output_gcp_storage_paths);

      if (paths.length > 0) {
        try {
          const { getFileFromStorage } = await import('@/lib/gcp-storage');
          outputImages = [];

          for (const path of paths) {
            const { data, contentType } = await getFileFromStorage(path);
            const base64Data = Buffer.from(data).toString('base64');
            outputImages.push({
              mimeType: contentType,
              data: base64Data,
              storagePath: path,
            });
          }
        } catch (error) {
          console.error('Failed to load output images:', error);
        }
      }
    }

    return NextResponse.json({
      success: true,
      id: queueItem.id,
      status: queueItem.status,
      workflowName: queueItem.comfyui_workflow_name,
      prompt: queueItem.prompt,
      error_message: queueItem.error_message,
      outputImages,
      created_at: queueItem.created_at,
      started_at: queueItem.started_at,
      completed_at: queueItem.completed_at,
      metadata: queueItem.metadata,
    });

  } catch (error: any) {
    console.error('Failed to get ComfyUI queue item:', error);
    return NextResponse.json(
      {
        error: 'Failed to get queue item',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
