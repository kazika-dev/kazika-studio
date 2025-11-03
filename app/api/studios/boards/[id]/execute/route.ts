import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBoardById, getStudioById, getStepsByBoardId, updateStep, updateBoard, getWorkflowById } from '@/lib/db';
import { executeWorkflow } from '@/lib/workflow/executor';
import { Node } from 'reactflow';

/**
 * POST /api/studios/boards/[id]/execute
 * ボードの全ステップを連鎖実行
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

    // ボードのステータスを処理中に更新
    await updateBoard(boardId, { status: 'processing' });

    // 全ステップを取得（順序順）
    const steps = await getStepsByBoardId(boardId);

    if (steps.length === 0) {
      return NextResponse.json(
        { error: 'No workflow steps found for this board' },
        { status: 400 }
      );
    }

    // 順次実行
    let previousOutputs: any = {};
    const executedSteps = [];

    try {
      for (const step of steps) {
        console.log(`Executing step ${step.step_order}: workflow ${step.workflow_id}`);

        // ステータスを実行中に更新
        await updateStep(step.id, { execution_status: 'running' });

        // ワークフローをDBから取得
        const workflow = await getWorkflowById(step.workflow_id);
        if (!workflow) {
          throw new Error(`Workflow ${step.workflow_id} not found`);
        }

        // ワークフローのノードとエッジを取得
        // DBから取得したデータは文字列の場合があるのでパース
        let nodes = workflow.nodes;
        let edges = workflow.edges;

        if (typeof nodes === 'string') {
          try {
            nodes = JSON.parse(nodes);
          } catch (e) {
            throw new Error(`Failed to parse workflow nodes: ${e}`);
          }
        }

        if (typeof edges === 'string') {
          try {
            edges = JSON.parse(edges);
          } catch (e) {
            throw new Error(`Failed to parse workflow edges: ${e}`);
          }
        }

        nodes = nodes || [];
        edges = edges || [];

        if (nodes.length === 0) {
          throw new Error(`Workflow ${step.workflow_id} has no nodes`);
        }

        // 入力を構築してノードに適用
        const inputs = buildInputs(step, previousOutputs, board);
        applyInputsToNodes(nodes, inputs);

        // ワークフローを実行
        const result = await executeWorkflow(nodes, edges);

        if (result.success) {
          // 成功: 出力を保存
          // results (Map) をオブジェクトに変換
          const outputData: any = {};
          result.results.forEach((execResult, nodeId) => {
            outputData[nodeId] = execResult.output;
          });

          const updatedStep = await updateStep(step.id, {
            execution_status: 'completed',
            output_data: outputData,
            error_message: null,
          });

          executedSteps.push(updatedStep);

          // 次のステップのために出力を保持
          previousOutputs = { ...previousOutputs, ...outputData };

          console.log(`Step ${step.step_order} completed successfully`);
        } else {
          // 失敗: エラーを記録して中断
          await updateStep(step.id, {
            execution_status: 'failed',
            error_message: result.error || 'Unknown error',
          });

          // ボードのステータスをエラーに更新
          await updateBoard(boardId, {
            status: 'error',
            error_message: `Step ${step.step_order} failed: ${result.error}`,
          });

          return NextResponse.json(
            {
              success: false,
              error: `Step ${step.step_order} failed: ${result.error}`,
              executedSteps,
            },
            { status: 500 }
          );
        }
      }

      // 全ステップ完了後、ボードを更新
      const updatedBoard = await updateBoardFromStepOutputs(boardId, previousOutputs);

      return NextResponse.json({
        success: true,
        board: updatedBoard,
        steps: executedSteps,
      });
    } catch (error: any) {
      console.error('Board execution error:', error);

      // ボードのステータスをエラーに更新
      await updateBoard(boardId, {
        status: 'error',
        error_message: error.message,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to execute board',
          details: error.message,
          executedSteps,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Board execution error:', error);
    return NextResponse.json(
      { error: 'Failed to execute board', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * ノードに入力を適用
 */
function applyInputsToNodes(nodes: Node[], inputs: any) {
  if (!inputs || Object.keys(inputs).length === 0) {
    return;
  }

  nodes.forEach((node: Node) => {
    const nodeType = node.data.type;

    // プロンプトを持つノード
    if (['gemini', 'nanobana', 'higgsfield', 'seedream4', 'elevenlabs'].includes(nodeType)) {
      if (inputs.prompt) {
        // プロンプトを設定または既存のプロンプトに追加
        const existingPrompt = node.data.config?.prompt || '';
        node.data.config = {
          ...node.data.config,
          prompt: existingPrompt ? `${existingPrompt} ${inputs.prompt}` : inputs.prompt,
        };
      }
    }

    // 画像入力ノード
    if (nodeType === 'imageInput') {
      if (inputs.images && Array.isArray(inputs.images) && inputs.images.length > 0) {
        // 最初の画像を使用
        node.data.config = {
          ...node.data.config,
          imageData: inputs.images[0],
        };
      }
    }

    // 入力ノード
    if (nodeType === 'input') {
      if (inputs.text) {
        node.data.config = {
          ...node.data.config,
          value: inputs.text,
        };
      }
    }
  });
}

/**
 * 入力を構築
 */
function buildInputs(step: any, previousOutputs: any, board: any) {
  const inputs: any = {};
  const config = step.input_config || {};

  // プロンプトを使用
  if (config.usePrompt) {
    inputs.prompt = config.prompt || board.prompt_text || '';
  }

  // 前のステップの出力から画像、動画、音声を探す
  if (config.usePreviousImage || config.usePreviousVideo || config.usePreviousAudio || config.usePreviousText) {
    // previousOutputsの全ノード出力を走査
    for (const [nodeId, output] of Object.entries(previousOutputs)) {
      const nodeOutput = output as any;

      // 画像を使用
      if (config.usePreviousImage && nodeOutput.imageData) {
        inputs.images = inputs.images || [];
        inputs.images.push(nodeOutput.imageData);
      }

      // 動画を使用
      if (config.usePreviousVideo && nodeOutput.videoUrl) {
        inputs.videoUrl = nodeOutput.videoUrl;
      }

      // 音声を使用
      if (config.usePreviousAudio && nodeOutput.audioData) {
        inputs.audioData = nodeOutput.audioData;
      }

      // テキストを使用
      if (config.usePreviousText && nodeOutput.text) {
        inputs.text = nodeOutput.text;
      }
    }
  }

  // カスタム入力をマージ
  if (config.customInputs) {
    Object.assign(inputs, config.customInputs);
  }

  console.log('Built inputs for step:', JSON.stringify(inputs, null, 2));
  return inputs;
}

/**
 * 全ステップの出力からボードを更新
 */
async function updateBoardFromStepOutputs(boardId: number, outputs: any) {
  const updateData: any = {
    status: 'completed' as const,
    error_message: null,
  };

  // 全ノード出力を走査して、最終的なメディアを見つける
  for (const [nodeId, output] of Object.entries(outputs)) {
    const nodeOutput = output as any;

    // 画像出力
    if (nodeOutput.imageData?.storagePath) {
      updateData.custom_image_url = nodeOutput.imageData.storagePath;
    }

    // 動画出力
    if (nodeOutput.videoUrl) {
      updateData.custom_video_url = nodeOutput.videoUrl;
    }

    // 音声出力
    if (nodeOutput.audioUrl) {
      updateData.custom_audio_url = nodeOutput.audioUrl;
    }
  }

  const updatedBoard = await updateBoard(boardId, updateData);
  return updatedBoard;
}
