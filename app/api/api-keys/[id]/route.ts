import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { query } from '@/lib/db';

/**
 * API キー更新（有効化/無効化、名前変更）
 * PATCH /api/api-keys/[id]
 *
 * Body:
 * {
 *   "isActive": true/false,
 *   "name": "New Name" (optional)
 * }
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const { isActive, name } = await request.json();

    // 更新フィールドを構築
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (typeof isActive === 'boolean') {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }

    if (typeof name === 'string' && name.trim()) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // WHERE 句のパラメータを追加
    values.push(id, user.id);

    const result = await query(
      `
      UPDATE kazikastudio.api_keys
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
      RETURNING id, name, is_active, last_used_at, created_at, expires_at
      `,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      apiKey: result.rows[0],
    });
  } catch (error: any) {
    console.error('API key update error:', error);
    return NextResponse.json(
      { error: 'Failed to update API key', details: error.message },
      { status: 500 }
    );
  }
}
