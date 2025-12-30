import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import { query } from '@/lib/db';

/**
 * PUT /api/prompt-queue/bulk-update
 * 複数のプロンプトキューを一括更新する
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { queue_ids, updates } = body;

    if (!queue_ids || !Array.isArray(queue_ids) || queue_ids.length === 0) {
      return NextResponse.json({ error: 'queue_ids is required and must be a non-empty array' }, { status: 400 });
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'updates is required and must be an object' }, { status: 400 });
    }

    // 更新可能なフィールドをフィルタリング
    const allowedFields = ['prompt', 'negative_prompt', 'model', 'aspect_ratio', 'priority', 'status', 'enhance_prompt', 'enhanced_prompt'];
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        updateValues.push(value);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // updated_at を追加
    updateFields.push(`updated_at = NOW()`);

    // キューIDの配列をプレースホルダに変換
    const queueIdPlaceholders = queue_ids.map((_, i) => `$${paramIndex + i}`).join(', ');
    updateValues.push(...queue_ids);

    // 一括更新クエリを実行（所有権チェックを含む）
    const updateQuery = `
      UPDATE kazikastudio.prompt_queues
      SET ${updateFields.join(', ')}
      WHERE id IN (${queueIdPlaceholders})
        AND user_id = $${paramIndex + queue_ids.length}
      RETURNING id
    `;
    updateValues.push(user.id);

    const result = await query(updateQuery, updateValues);

    return NextResponse.json({
      success: true,
      updated_count: result.rowCount,
      updated_ids: result.rows.map((row: any) => row.id),
    });
  } catch (error: any) {
    console.error('Failed to bulk update queues:', error);
    return NextResponse.json(
      { error: 'Failed to bulk update queues', details: error.message },
      { status: 500 }
    );
  }
}
