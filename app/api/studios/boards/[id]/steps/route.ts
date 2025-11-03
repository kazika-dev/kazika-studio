import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBoardById, getStudioById, getStepsByBoardId, createStep } from '@/lib/db';

/**
 * GET /api/studios/boards/[id]/steps
 * ボードの全ステップを取得（順序順）
 */
export async function GET(
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
    const boardId = parseInt(id);
    if (isNaN(boardId)) {
      return NextResponse.json(
        { error: 'Invalid board ID' },
        { status: 400 }
      );
    }

    const board = await getBoardById(boardId);

    if (!board) {
      return NextResponse.json(
        { error: 'Board not found' },
        { status: 404 }
      );
    }

    // 所有者確認（スタジオの所有者をチェック）
    const studio = await getStudioById(board.studio_id);
    if (!studio || studio.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const steps = await getStepsByBoardId(boardId);

    return NextResponse.json({
      success: true,
      steps,
    });
  } catch (error: any) {
    console.error('Get steps error:', error);
    return NextResponse.json(
      { error: 'Failed to get steps', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/studios/boards/[id]/steps
 * 新しいステップを作成
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
    const boardId = parseInt(id);
    if (isNaN(boardId)) {
      return NextResponse.json(
        { error: 'Invalid board ID' },
        { status: 400 }
      );
    }

    const board = await getBoardById(boardId);

    if (!board) {
      return NextResponse.json(
        { error: 'Board not found' },
        { status: 404 }
      );
    }

    // 所有者確認
    const studio = await getStudioById(board.studio_id);
    if (!studio || studio.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { workflow_id, step_order, input_config } = body;

    if (!workflow_id) {
      return NextResponse.json(
        { error: 'workflow_id is required' },
        { status: 400 }
      );
    }

    if (step_order === undefined || step_order === null) {
      return NextResponse.json(
        { error: 'step_order is required' },
        { status: 400 }
      );
    }

    const step = await createStep({
      board_id: boardId,
      workflow_id,
      step_order,
      input_config: input_config || {},
    });

    return NextResponse.json({
      success: true,
      step,
    });
  } catch (error: any) {
    console.error('Create step error:', error);
    return NextResponse.json(
      { error: 'Failed to create step', details: error.message },
      { status: 500 }
    );
  }
}
