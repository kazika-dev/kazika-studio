import { NextRequest, NextResponse } from 'next/server';
import { executeWorkflow } from '@/lib/workflow/executor';
import { Node } from 'reactflow';

// Next.jsのルートハンドラの設定（ワークフロー実行は時間がかかる可能性がある）
export const maxDuration = 300; // 5分（秒単位）- Vercel hobby plan limit

/**
 * 現在編集中のワークフロー（未保存）を実行するAPI
 * ExecutionPanelから呼び出される
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nodes, edges } = body;

    if (!nodes || !Array.isArray(nodes)) {
      return NextResponse.json(
        { error: 'nodes is required and must be an array' },
        { status: 400 }
      );
    }

    if (!edges || !Array.isArray(edges)) {
      return NextResponse.json(
        { error: 'edges is required and must be an array' },
        { status: 400 }
      );
    }

    if (nodes.length === 0) {
      return NextResponse.json(
        { error: 'Workflow has no nodes' },
        { status: 400 }
      );
    }

    console.log('Executing draft workflow via API:', {
      nodeCount: nodes.length,
      edgeCount: edges.length,
    });

    // ワークフローを実行
    const result = await executeWorkflow(nodes, edges);

    if (!result.success) {
      console.error('Draft workflow execution failed:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Workflow execution failed',
        },
        { status: 500 }
      );
    }

    // 結果を整形して返す
    const outputs: any = {};
    result.results.forEach((nodeResult, nodeId) => {
      const node = nodes.find((n: Node) => n.id === nodeId);
      const nodeName = node?.data?.config?.name || nodeId;

      outputs[nodeName] = {
        nodeId,
        nodeType: node?.data?.type,
        success: nodeResult.success,
        output: nodeResult.output,
        error: nodeResult.error,
        requestBody: nodeResult.requestBody,
      };
    });

    return NextResponse.json({
      success: true,
      outputs,
      executionTime: Date.now(),
    });

  } catch (error: any) {
    console.error('Draft workflow execution API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute workflow',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
