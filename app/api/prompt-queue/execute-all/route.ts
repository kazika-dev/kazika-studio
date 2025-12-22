import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import { getPendingPromptQueues } from '@/lib/db';
import { getApiUrl } from '@/lib/utils/apiUrl';

/**
 * POST /api/prompt-queue/execute-all
 * 全ての pending キューを順次実行
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // pending のキューを取得
    const pendingQueues = await getPendingPromptQueues(user.id);

    if (pendingQueues.length === 0) {
      return NextResponse.json({
        success: true,
        executed: 0,
        failed: 0,
        results: [],
        message: 'No pending queues to execute',
      });
    }

    const results: { queue_id: number; success: boolean; error?: string }[] = [];
    let executed = 0;
    let failed = 0;

    // 順次実行（レート制限回避のため）
    for (const queue of pendingQueues) {
      try {
        const executeResponse = await fetch(
          getApiUrl(`/api/prompt-queue/${queue.id}/execute`),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // 内部呼び出しのため、Cookie を転送
              Cookie: request.headers.get('cookie') || '',
            },
          }
        );

        if (executeResponse.ok) {
          results.push({ queue_id: queue.id, success: true });
          executed++;
        } else {
          const errorData = await executeResponse.json().catch(() => ({}));
          results.push({
            queue_id: queue.id,
            success: false,
            error: errorData.error || 'Execution failed',
          });
          failed++;
        }

        // レート制限回避のため、間隔を空ける
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        results.push({
          queue_id: queue.id,
          success: false,
          error: error.message,
        });
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      executed,
      failed,
      results,
    });
  } catch (error: any) {
    console.error('Failed to execute all prompt queues:', error);
    return NextResponse.json(
      { error: 'Failed to execute all prompt queues', details: error.message },
      { status: 500 }
    );
  }
}
