import { NextRequest, NextResponse } from 'next/server';
import { createKazikaClient } from '@/lib/kazika-db-client';
import { getStoriesTreeByUserId } from '@/lib/db';

/**
 * GET /api/stories/tree
 * ユーザーの全ストーリー・シーン・会話の階層構造を取得
 */
export async function GET(request: NextRequest) {
  try {
    const db = await createKazikaClient();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tree = await getStoriesTreeByUserId(user.id);

    return NextResponse.json({
      success: true,
      data: {
        tree,
      },
    });
  } catch (error) {
    console.error('Failed to fetch stories tree:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stories tree' },
      { status: 500 }
    );
  }
}
