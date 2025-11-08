import { NextRequest, NextResponse } from 'next/server';
import { getComfyUIQueueItemById } from '@/lib/db';
import { getSignedUrl } from '@/lib/gcp-storage';

// ステータスチェック用のGETエンドポイント
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const queueItemId = parseInt(params.id, 10);

    if (isNaN(queueItemId)) {
      return NextResponse.json(
        { error: 'Invalid queue item ID' },
        { status: 400 }
      );
    }

    // キューアイテムを取得
    const queueItem = await getComfyUIQueueItemById(queueItemId);

    if (!queueItem) {
      return NextResponse.json(
        { error: 'Queue item not found' },
        { status: 404 }
      );
    }

    // DBのステータスをそのまま返す
    if (queueItem.status === 'completed') {
      // output_gcp_storage_pathsから画像パスを取得
      const outputPaths = queueItem.output_gcp_storage_paths;

      if (!outputPaths || !Array.isArray(outputPaths) || outputPaths.length === 0) {
        return NextResponse.json({
          status: 'completed',
          imageUrl: null,
          error: 'No output image path found',
        });
      }

      // 最初の画像パスから署名付きURLを生成（24時間有効）
      const imagePath = outputPaths[0];
      const imageUrl = await getSignedUrl(imagePath, 24 * 60);

      return NextResponse.json({
        status: 'completed',
        imageUrl: imageUrl,
      });
    }

    if (queueItem.status === 'failed') {
      return NextResponse.json({
        status: 'failed',
        error_message: queueItem.error_message,
      });
    }

    // pending または processing
    return NextResponse.json({
      status: queueItem.status,
    });

  } catch (error: any) {
    console.error('Qwen Image status check error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check status',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
