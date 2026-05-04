import { NextRequest, NextResponse } from 'next/server';
import { createKazikaClient } from '@/lib/kazika-db-client';
import { getStudiosByUserId, createStudio } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth/apiAuth';

/**
 * GET /api/studios
 * ユーザーの全スタジオを取得
 */
export async function GET(request: NextRequest) {
  try {
    const db = await createKazikaClient();
    const { data: { user }, error: authError } = await db.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const studios = await getStudiosByUserId(user.id);

    return NextResponse.json({
      success: true,
      studios,
    });
  } catch (error: any) {
    console.error('Get studios error:', error);
    return NextResponse.json(
      { error: 'Failed to get studios', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/studios
 * 新しいスタジオを作成
 */
export async function POST(request: NextRequest) {
  try {
    const db = await createKazikaClient();
    const { data: { user }, error: authError } = await db.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, thumbnail_url, metadata } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const studio = await createStudio({
      user_id: user.id,
      name: name.trim(),
      description: description || '',
      thumbnail_url: thumbnail_url || null,
      metadata: metadata || {},
    });

    return NextResponse.json({
      success: true,
      studio,
    });
  } catch (error: any) {
    console.error('Create studio error:', error);
    return NextResponse.json(
      { error: 'Failed to create studio', details: error.message },
      { status: 500 }
    );
  }
}
