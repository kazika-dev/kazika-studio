import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStudioById, reorderBoards } from '@/lib/db';

/**
 * POST /api/studios/[id]/boards/reorder
 * ボードの順序を変更
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const studioId = parseInt(id);
    if (isNaN(studioId)) {
      return NextResponse.json(
        { error: 'Invalid studio ID' },
        { status: 400 }
      );
    }

    const studio = await getStudioById(studioId);

    if (!studio) {
      return NextResponse.json(
        { error: 'Studio not found' },
        { status: 404 }
      );
    }

    // 所有者確認
    if (studio.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { boardIds } = body;

    if (!Array.isArray(boardIds)) {
      return NextResponse.json(
        { error: 'boardIds must be an array' },
        { status: 400 }
      );
    }

    await reorderBoards(studioId, boardIds);

    return NextResponse.json({
      success: true,
      message: 'Boards reordered successfully',
    });
  } catch (error: any) {
    console.error('Reorder boards error:', error);
    return NextResponse.json(
      { error: 'Failed to reorder boards', details: error.message },
      { status: 500 }
    );
  }
}
