import { NextRequest, NextResponse } from 'next/server';
import { executeWorkflow } from '@/lib/workflow/executor';
import { getWorkflowById } from '@/lib/db';

// Next.jsのルートハンドラの設定（ワークフロー実行は時間がかかる可能性がある）
export const maxDuration = 600; // 10分（秒単位）

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowId, inputs } = body;

    if (!workflowId) {
      return NextResponse.json(
        { error: 'workflowId is required' },
        { status: 400 }
      );
    }

    // ワークフローをDBから取得
    const workflow = await getWorkflowById(workflowId);

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // ワークフローのノードとエッジを取得
    const nodes = workflow.nodes || [];
    const edges = workflow.edges || [];

    if (nodes.length === 0) {
      return NextResponse.json(
        { error: 'Workflow has no nodes' },
        { status: 400 }
      );
    }

    // ユーザーからの入力を入力ノードに適用
    if (inputs) {
      nodes.forEach(node => {
        // 入力ノードや画像入力ノードに値を設定
        if (node.data.type === 'input' && inputs.text !== undefined) {
          node.data.config = {
            ...node.data.config,
            value: inputs.text,
          };
        } else if (node.data.type === 'imageInput' && inputs.images) {
          // 複数の画像入力ノードがある場合は、順番に割り当て
          const imageInputNodes = nodes.filter(n => n.data.type === 'imageInput');
          const nodeIndex = imageInputNodes.findIndex(n => n.id === node.id);

          if (nodeIndex >= 0 && inputs.images[nodeIndex]) {
            node.data.config = {
              ...node.data.config,
              imageData: inputs.images[nodeIndex],
            };
          }
        }

        // プロンプトを持つノードに入力テキストを適用（オプション）
        if (inputs.prompt && ['gemini', 'nanobana', 'higgsfield', 'seedream4'].includes(node.data.type)) {
          // ノードのプロンプトに{{input}}があれば置換
          if (node.data.config?.prompt?.includes('{{input}}')) {
            node.data.config.prompt = node.data.config.prompt.replace(/\{\{input\}\}/g, inputs.prompt);
          }
        }
      });
    }

    console.log('Executing workflow via API:', {
      workflowId,
      workflowName: workflow.name,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      hasInputs: !!inputs,
    });

    // ワークフローを実行
    const result = await executeWorkflow(nodes, edges);

    if (!result.success) {
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
      const node = nodes.find(n => n.id === nodeId);
      const nodeName = node?.data?.config?.name || nodeId;

      outputs[nodeName] = {
        nodeId,
        nodeType: node?.data?.type,
        success: nodeResult.success,
        output: nodeResult.output,
        error: nodeResult.error,
      };
    });

    return NextResponse.json({
      success: true,
      workflowId,
      workflowName: workflow.name,
      outputs,
      executionTime: Date.now(),
    });

  } catch (error: any) {
    console.error('Workflow execution API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute workflow',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
