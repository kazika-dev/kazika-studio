import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * PATCH /api/studios/steps/[id]/update-node-inputs
 *
 * ステップ内の特定ノードの入力設定を更新する
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const stepId = parseInt(params.id, 10);
    if (isNaN(stepId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid step ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { nodeId, inputs } = body;

    if (!nodeId || !inputs) {
      return NextResponse.json(
        { success: false, error: 'nodeId and inputs are required' },
        { status: 400 }
      );
    }

    // ステップ情報を取得
    const stepResult = await query(
      `SELECT id, metadata FROM kazikastudio.studio_board_workflow_steps WHERE id = $1`,
      [stepId]
    );

    if (stepResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Step not found' },
        { status: 404 }
      );
    }

    const step = stepResult.rows[0];
    const metadata = step.metadata || {};

    // execution_requests に入力設定を保存（または更新）
    if (!metadata.execution_requests) {
      metadata.execution_requests = {};
    }

    metadata.execution_requests[nodeId] = inputs;

    // メタデータを更新
    await query(
      `UPDATE kazikastudio.studio_board_workflow_steps
       SET metadata = $1, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(metadata), stepId]
    );

    console.log(`✓ Updated inputs for node ${nodeId} in step ${stepId}`);

    return NextResponse.json({
      success: true,
      stepId,
      nodeId,
      inputs,
    });
  } catch (error: any) {
    console.error('Error updating node inputs:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update node inputs' },
      { status: 500 }
    );
  }
}
