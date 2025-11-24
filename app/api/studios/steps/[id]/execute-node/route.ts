import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getStepById, updateStep, getWorkflowById } from '@/lib/db';
import { executeNode } from '@/lib/workflow/nodeExecutor';

interface Context {
  params: Promise<{
    id: string;
  }>;
}

/**
 * ノード単位実行API
 * 特定のステップ内の特定のノードのみを実行する
 */
export async function POST(request: NextRequest, context: Context) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const stepId = params.id;
    const body = await request.json();
    const { nodeId } = body;

    if (!nodeId) {
      return NextResponse.json(
        { error: 'nodeId is required' },
        { status: 400 }
      );
    }

    console.log(`=== Execute single node: step=${stepId}, node=${nodeId} ===`);

    // ステップ情報を取得
    const step = await getStepById(stepId);
    if (!step) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    // ワークフロー情報を取得
    const workflow = await getWorkflowById(step.workflow_id);
    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    let nodes = workflow.nodes;
    let edges = workflow.edges;

    // JSON文字列の場合はパース
    if (typeof nodes === 'string') {
      nodes = JSON.parse(nodes);
    }
    if (typeof edges === 'string') {
      edges = JSON.parse(edges);
    }

    // 実行対象ノードを取得
    const node = nodes.find((n: any) => n.id === nodeId);
    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    console.log(`Executing node: ${node.id} (type: ${node.data.type})`);

    // 依存ノードの出力を収集（エッジベース）
    const inputs = collectNodeInputs(nodeId, edges, step.output_data || {});
    console.log('Collected inputs for node:', JSON.stringify(inputs, null, 2));

    // ノードを実行
    const startTime = new Date().toISOString();
    const result = await executeNode(node, inputs);
    const endTime = new Date().toISOString();

    if (!result.success) {
      console.error(`Node execution failed: ${result.error}`);
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Node execution failed',
        },
        { status: 500 }
      );
    }

    console.log('Node execution succeeded');
    console.log('Output:', JSON.stringify(result.output, null, 2));

    // 結果を保存（部分更新）
    const updatedOutputData = {
      ...(step.output_data || {}),
      [nodeId]: result.output,
    };

    const updatedMetadata = {
      ...(step.metadata || {}),
      execution_requests: {
        ...(step.metadata?.execution_requests || {}),
        [nodeId]: result.requestBody,
      },
      node_execution_times: {
        ...(step.metadata?.node_execution_times || {}),
        [nodeId]: {
          start: startTime,
          end: endTime,
          duration: new Date(endTime).getTime() - new Date(startTime).getTime(),
        },
      },
    };

    await updateStep(stepId, {
      output_data: updatedOutputData,
      metadata: updatedMetadata,
    });

    console.log(`Node ${nodeId} execution completed and saved`);

    return NextResponse.json({
      success: true,
      nodeId,
      output: result.output,
      executionTime: {
        start: startTime,
        end: endTime,
      },
    });
  } catch (error: any) {
    console.error('Error executing node:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute node',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * 依存ノードの出力を収集（エッジベース）
 */
function collectNodeInputs(
  nodeId: string,
  edges: any[],
  outputData: Record<string, any>
): any {
  const inputs: any = {};

  // このノードへの入力エッジを取得
  const incomingEdges = edges.filter((e: any) => e.target === nodeId);

  console.log(
    `Collecting inputs for node ${nodeId}: ${incomingEdges.length} incoming edges`
  );

  for (const edge of incomingEdges) {
    const sourceNodeId = edge.source;
    const sourceOutput = outputData[sourceNodeId];

    if (!sourceOutput) {
      console.log(
        `  - Edge from ${sourceNodeId}: no output available (skipped)`
      );
      continue;
    }

    console.log(`  - Edge from ${sourceNodeId}: output available`);

    // sourceHandle に応じて入力を追加
    const sourceHandle = edge.sourceHandle;

    if (sourceHandle === 'image' || sourceOutput.imageData || sourceOutput.imageUrl) {
      inputs.previousImages = inputs.previousImages || [];
      inputs.previousImages.push({
        imageData: sourceOutput.imageData,
        imageUrl: sourceOutput.imageUrl,
        storagePath: sourceOutput.storagePath,
      });
      console.log(`    → Added to previousImages`);
    } else if (sourceHandle === 'video' || sourceOutput.videoUrl) {
      inputs.previousVideos = inputs.previousVideos || [];
      inputs.previousVideos.push({
        videoUrl: sourceOutput.videoUrl,
      });
      console.log(`    → Added to previousVideos`);
    } else if (sourceHandle === 'audio' || sourceOutput.audioData) {
      inputs.previousAudios = inputs.previousAudios || [];
      inputs.previousAudios.push({
        audioData: sourceOutput.audioData,
      });
      console.log(`    → Added to previousAudios`);
    } else if (sourceHandle === 'prompt' || sourceOutput.text || sourceOutput.prompt) {
      const promptText = sourceOutput.text || sourceOutput.prompt || sourceOutput.response;
      if (!inputs.prompt) {
        inputs.prompt = promptText;
      } else {
        inputs.prompt += '\n' + promptText;
      }
      console.log(`    → Added to prompt`);
    }
  }

  console.log('Final collected inputs:', Object.keys(inputs));

  return inputs;
}
