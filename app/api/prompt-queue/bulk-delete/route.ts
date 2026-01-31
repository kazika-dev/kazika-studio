import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import { query } from '@/lib/db';

/**
 * DELETE /api/prompt-queue/bulk-delete
 * 複数のプロンプトキューを一括削除する
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { queue_ids } = body;

    if (!queue_ids || !Array.isArray(queue_ids) || queue_ids.length === 0) {
      return NextResponse.json(
        { error: 'queue_ids is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    // キューIDの配列をプレースホルダに変換
    const queueIdPlaceholders = queue_ids.map((_, i) => `$${i + 1}`).join(', ');

    // 一括削除クエリを実行（所有権チェックを含む）
    const deleteQuery = `
      DELETE FROM kazikastudio.prompt_queues
      WHERE id IN (${queueIdPlaceholders})
        AND user_id = $${queue_ids.length + 1}
      RETURNING id
    `;

    const result = await query(deleteQuery, [...queue_ids, user.id]);

    return NextResponse.json({
      success: true,
      deleted_count: result.rowCount,
      deleted_ids: result.rows.map((row: any) => row.id),
    });
  } catch (error: any) {
    console.error('Failed to bulk delete queues:', error);
    return NextResponse.json(
      { error: 'Failed to bulk delete queues', details: error.message },
      { status: 500 }
    );
  }
}
