import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const boardId = parseInt(id);
    if (isNaN(boardId)) {
      return NextResponse.json(
        { success: false, error: '無効なボードIDです' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // ボードの存在確認
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('id')
      .eq('id', boardId)
      .single();

    if (boardError || !board) {
      return NextResponse.json(
        { success: false, error: 'ボードが見つかりません' },
        { status: 404 }
      );
    }

    // ボードのWorkflowStepsを取得（step_orderで降順ソート）
    const { data: steps, error: stepsError } = await supabase
      .from('workflow_steps')
      .select(`
        *,
        workflows:workflow_id (
          name,
          description
        )
      `)
      .eq('board_id', boardId)
      .eq('execution_status', 'completed')
      .order('step_order', { ascending: false })
      .limit(1);

    if (stepsError) {
      console.error('Failed to fetch last workflow step:', stepsError);
      return NextResponse.json(
        { success: false, error: 'ステップの取得に失敗しました' },
        { status: 500 }
      );
    }

    const lastStep = steps && steps.length > 0 ? steps[0] : null;

    // ワークフロー名を追加
    const enrichedStep = lastStep
      ? {
          ...lastStep,
          workflow_name: lastStep.workflows?.name,
          workflow_description: lastStep.workflows?.description,
        }
      : null;

    return NextResponse.json({
      success: true,
      step: enrichedStep,
    });
  } catch (error) {
    console.error('Error in GET /api/studios/boards/[id]/steps/last:', error);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
