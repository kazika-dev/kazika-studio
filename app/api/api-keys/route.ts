import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { query } from '@/lib/db';
import { generateApiKey, hashApiKey } from '@/lib/auth/apiAuth';

/**
 * API キー一覧取得
 * GET /api/api-keys
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ユーザーの API キー一覧を取得（key_hash は除外）
    const result = await query(
      `
      SELECT
        id,
        name,
        last_used_at,
        created_at,
        expires_at,
        is_active,
        metadata
      FROM kazikastudio.api_keys
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [user.id]
    );

    return NextResponse.json({
      success: true,
      apiKeys: result.rows,
    });
  } catch (error: any) {
    console.error('API keys fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * API キー作成
 * POST /api/api-keys
 *
 * Body:
 * {
 *   "name": "Chrome Extension",
 *   "expiresAt": "2026-12-31T23:59:59Z" (optional)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "apiKey": "sk_xxxxxxxxxxxxxxxxxxxxx",  ← 1回のみ表示
 *   "id": "uuid",
 *   "name": "Chrome Extension",
 *   "createdAt": "2025-12-07T12:34:56Z"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, expiresAt } = await request.json();

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // API キーを生成
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);

    // データベースに保存
    const result = await query(
      `
      INSERT INTO kazikastudio.api_keys (user_id, key_hash, name, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, created_at, expires_at, is_active
      `,
      [user.id, keyHash, name, expiresAt || null]
    );

    const newKey = result.rows[0];

    return NextResponse.json({
      success: true,
      apiKey, // ⚠️ 1回のみ表示（以降は取得不可）
      id: newKey.id,
      name: newKey.name,
      createdAt: newKey.created_at,
      expiresAt: newKey.expires_at,
      isActive: newKey.is_active,
    });
  } catch (error: any) {
    console.error('API key creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create API key', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * API キー削除
 * DELETE /api/api-keys?id=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // 自分の API キーのみ削除可能
    const result = await query(
      `
      DELETE FROM kazikastudio.api_keys
      WHERE id = $1 AND user_id = $2
      RETURNING id
      `,
      [id, user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'API key deleted successfully',
    });
  } catch (error: any) {
    console.error('API key deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete API key', details: error.message },
      { status: 500 }
    );
  }
}
