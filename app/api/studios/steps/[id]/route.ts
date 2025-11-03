import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStepById, getBoardById, getStudioById, updateStep, deleteStep } from '@/lib/db';

/**
 * GET /api/studios/steps/[id]
 * 特定のステップを取得
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
    const stepId = parseInt(id);
    if (isNaN(stepId)) {
      return NextResponse.json(
        { error: 'Invalid step ID' },
        { status: 400 }
      );
    }

    const step = await getStepById(stepId);

    if (!step) {
      return NextResponse.json(
        { error: 'Step not found' },
        { status: 404 }
      );
    }

    // 所有者確認
    const board = await getBoardById(step.board_id);
    const studio = await getStudioById(board.studio_id);
    if (!studio || studio.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      step,
    });
  } catch (error: any) {
    console.error('Get step error:', error);
    return NextResponse.json(
      { error: 'Failed to get step', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/studios/steps/[id]
 * ステップを更新
 */
export async function PUT(
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
    const stepId = parseInt(id);
    if (isNaN(stepId)) {
      return NextResponse.json(
        { error: 'Invalid step ID' },
        { status: 400 }
      );
    }

    const step = await getStepById(stepId);

    if (!step) {
      return NextResponse.json(
        { error: 'Step not found' },
        { status: 404 }
      );
    }

    // 所有者確認
    const board = await getBoardById(step.board_id);
    const studio = await getStudioById(board.studio_id);
    if (!studio || studio.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();

    const updatedStep = await updateStep(stepId, body);

    return NextResponse.json({
      success: true,
      step: updatedStep,
    });
  } catch (error: any) {
    console.error('Update step error:', error);
    return NextResponse.json(
      { error: 'Failed to update step', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/studios/steps/[id]
 * ステップを削除
 */
export async function DELETE(
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
    const stepId = parseInt(id);
    if (isNaN(stepId)) {
      return NextResponse.json(
        { error: 'Invalid step ID' },
        { status: 400 }
      );
    }

    const step = await getStepById(stepId);

    if (!step) {
      return NextResponse.json(
        { error: 'Step not found' },
        { status: 404 }
      );
    }

    // 所有者確認
    const board = await getBoardById(step.board_id);
    const studio = await getStudioById(board.studio_id);
    if (!studio || studio.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    await deleteStep(stepId);

    return NextResponse.json({
      success: true,
      message: 'Step deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete step error:', error);
    return NextResponse.json(
      { error: 'Failed to delete step', details: error.message },
      { status: 500 }
    );
  }
}
