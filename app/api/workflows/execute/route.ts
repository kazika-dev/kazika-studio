import { NextRequest, NextResponse } from 'next/server';
import { executeWorkflow } from '@/lib/workflow/executor';
import { getWorkflowById } from '@/lib/db';
import { Node } from 'reactflow';
import { createClient } from '@/lib/supabase/server';

// Next.jsのルートハンドラの設定（ワークフロー実行は時間がかかる可能性がある）
export const maxDuration = 600; // 10分（秒単位）

export async function POST(request: NextRequest) {
  let workflowId: number | undefined;
  let workflow: any = null;

  try {
    const body = await request.json();
    workflowId = body.workflowId;
    const inputs = body.inputs;

    if (!workflowId) {
      return NextResponse.json(
        { error: 'workflowId is required' },
        { status: 400 }
      );
    }

    // ワークフローをDBから取得
    workflow = await getWorkflowById(workflowId);

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

    // 画像データを省略してログ出力するヘルパー関数
    const sanitizeForLog = (obj: any): any => {
      if (!obj) return obj;
      if (typeof obj !== 'object') return obj;

      if (Array.isArray(obj)) {
        return obj.map(item => sanitizeForLog(item));
      }

      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key === 'imageData' && value) {
          sanitized[key] = '[IMAGE_DATA_OMITTED]';
        } else if (typeof value === 'string' && value.length > 500 && value.startsWith('data:image')) {
          sanitized[key] = '[BASE64_IMAGE_OMITTED]';
        } else if (typeof value === 'object') {
          sanitized[key] = sanitizeForLog(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    };

    // ユーザーからの入力を入力ノードに適用
    console.log('========================================');
    console.log('Applying user inputs to nodes');
    console.log('========================================');
    console.log('Input keys:', inputs ? Object.keys(inputs) : []);
    console.log('Inputs:', JSON.stringify(sanitizeForLog(inputs), null, 2));
    console.log('Node count:', nodes.length);
    console.log('Nodes:', nodes.map((n: Node) => ({
      id: n.id,
      type: n.data.type,
      name: n.data.config?.name,
      currentValue: n.data.config?.value,
      currentPrompt: n.data.config?.prompt,
      currentImageData: n.data.config?.imageData ? '[HAS_IMAGE_DATA]' : 'none',
    })));
    console.log('========================================');

    if (inputs) {
      nodes.forEach((node: Node) => {
        const nodeType = node.data.type;
        const nodeId = node.id;

        // 入力ノード: input_{nodeId} フィールドから値を取得
        if (nodeType === 'input') {
          const fieldName = `input_${nodeId}`;
          console.log(`Processing input node ${nodeId}:`, {
            fieldName,
            hasField: inputs[fieldName] !== undefined,
            hasText: inputs.text !== undefined,
            currentValue: node.data.config?.value,
            currentConfig: sanitizeForLog(node.data.config),
          });

          if (inputs[fieldName] !== undefined) {
            console.log(`✓ Setting input node ${nodeId} value from field ${fieldName}:`, inputs[fieldName]);
            node.data.config = {
              ...node.data.config,
              value: inputs[fieldName],
            };
          }
          // 後方互換性: inputs.text も確認
          else if (inputs.text !== undefined) {
            console.log(`✓ Setting input node ${nodeId} value from inputs.text:`, inputs.text);
            node.data.config = {
              ...node.data.config,
              value: inputs.text,
            };
          } else {
            console.log(`✗ No matching input field found for input node ${nodeId}`);
          }
        }

        // 画像入力ノード: image_{nodeId} フィールドから値を取得
        if (nodeType === 'imageInput') {
          const fieldName = `image_${nodeId}`;
          console.log(`Processing imageInput node ${nodeId}:`, {
            fieldName,
            hasField: inputs[fieldName] !== undefined,
            hasImages: inputs.images !== undefined,
            currentImageData: node.data.config?.imageData ? 'exists' : 'none',
          });

          if (inputs[fieldName] !== undefined) {
            console.log(`✓ Setting imageInput node ${nodeId} from field ${fieldName}`);
            // 単一画像の場合はそのまま、配列の場合は最初の画像を使用
            const imageData = Array.isArray(inputs[fieldName])
              ? inputs[fieldName][0]
              : inputs[fieldName];

            node.data.config = {
              ...node.data.config,
              imageData: imageData,
            };
          }
          // 後方互換性: inputs.images も確認
          else if (inputs.images) {
            const imageInputNodes = nodes.filter((n: Node) => n.data.type === 'imageInput');
            const nodeIndex = imageInputNodes.findIndex((n: Node) => n.id === nodeId);

            if (nodeIndex >= 0 && inputs.images[nodeIndex]) {
              console.log(`✓ Setting imageInput node ${nodeId} from inputs.images[${nodeIndex}]`);
              node.data.config = {
                ...node.data.config,
                imageData: inputs.images[nodeIndex],
              };
            } else {
              console.log(`✗ Image not found at index ${nodeIndex} for imageInput node ${nodeId}`);
            }
          } else {
            console.log(`✗ No matching image field found for imageInput node ${nodeId}`);
          }
        }

        // プロンプトを持つノード: {nodeType}_prompt_{nodeId} フィールドから値を取得
        if (['gemini', 'nanobana', 'higgsfield', 'seedream4'].includes(nodeType)) {
          const fieldName = `${nodeType}_prompt_${nodeId}`;
          console.log(`Processing ${nodeType} node ${nodeId} prompt:`, {
            fieldName,
            hasField: inputs[fieldName] !== undefined,
            hasPrompt: inputs.prompt !== undefined,
            currentPrompt: node.data.config?.prompt,
            hasPlaceholder: node.data.config?.prompt?.includes('{{input}}'),
          });

          if (inputs[fieldName] !== undefined) {
            const workflowPrompt = node.data.config?.prompt || '';
            const formPrompt = inputs[fieldName];
            const combinedPrompt = workflowPrompt ? `${workflowPrompt} ${formPrompt}` : formPrompt;

            console.log(`✓ Concatenating ${nodeType} node ${nodeId} prompt:`);
            console.log(`  Workflow prompt: ${workflowPrompt}`);
            console.log(`  Form prompt: ${formPrompt}`);
            console.log(`  Combined: ${combinedPrompt}`);

            node.data.config = {
              ...node.data.config,
              prompt: combinedPrompt,
            };
          }
          // 後方互換性: inputs.prompt で {{input}} を置換
          else if (inputs.prompt && node.data.config?.prompt?.includes('{{input}}')) {
            console.log(`✓ Replacing {{input}} in ${nodeType} node ${nodeId} with:`, inputs.prompt);
            node.data.config.prompt = node.data.config.prompt.replace(/\{\{input\}\}/g, inputs.prompt);
          } else {
            console.log(`✗ No matching prompt field or placeholder found for ${nodeType} node ${nodeId}`);
          }
        }
      });

      // 適用後の状態をログ出力
      console.log('========================================');
      console.log('Nodes after applying inputs');
      console.log('========================================');
      nodes.forEach((n: Node) => {
        console.log(`Node ${n.id} (${n.data.type}):`);
        console.log('  Name:', n.data.config?.name);
        console.log('  Value:', n.data.config?.value);
        console.log('  Prompt:', n.data.config?.prompt);
        console.log('  ImageData:', n.data.config?.imageData ? '[HAS_IMAGE_DATA]' : 'none');
        console.log('  Full config:', JSON.stringify(sanitizeForLog(n.data.config), null, 2));
      });
      console.log('========================================');
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
      console.error('========================================');
      console.error('Workflow execution returned failure');
      console.error('========================================');
      console.error('Workflow ID:', workflowId);
      console.error('Workflow name:', workflow.name);
      console.error('Error message:', result.error);
      console.error('Results map size:', result.results.size);

      // Log all node results to see which node failed
      console.error('Node results:');
      result.results.forEach((nodeResult, nodeId) => {
        console.error(`  Node ${nodeId}:`, {
          success: nodeResult.success,
          error: nodeResult.error,
          hasOutput: !!nodeResult.output,
        });
      });
      console.error('========================================');

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
        requestBody: nodeResult.requestBody, // APIに送信したリクエストボディ
      };
    });

    // 実行結果をoutputsテーブルに保存（最終ノードのみ）
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // 最終ノードを特定（出力エッジがないノード）
        const sourceNodeIds = new Set(edges.map((e: any) => e.source));
        const finalNodeIds = nodes
          .map((n: Node) => n.id)
          .filter((id: string) => !sourceNodeIds.has(id));

        console.log('Final nodes to save:', finalNodeIds);

        const savePromises: any[] = [];

        result.results.forEach((nodeResult, nodeId) => {
          // 最終ノードでない場合はスキップ
          if (!finalNodeIds.includes(nodeId)) return;
          if (!nodeResult.success || !nodeResult.output) return;

          const node = nodes.find((n: Node) => n.id === nodeId);
          const nodeType = node?.data?.type;
          const output = nodeResult.output;

          // プロンプトを抽出（あれば）
          const prompt = nodeResult.requestBody?.prompt || node?.data?.config?.prompt || null;

          // ノードタイプに応じて保存
          if (nodeType === 'nanobana' || nodeType === 'higgsfield' || nodeType === 'seedream4') {
            // 画像生成ノード
            if (output.imageData || output.storagePath) {
              const insertData: any = {
                user_id: user.id,
                workflow_id: workflowId,
                output_type: 'image',
                content_url: output.storagePath || null,
                prompt: prompt,
                metadata: {
                  nodeId,
                  nodeType,
                  nodeName: node?.data?.config?.name,
                  aspectRatio: node?.data?.config?.aspectRatio,
                },
              };

              savePromises.push(
                supabase.from('workflow_outputs').insert(insertData).select()
              );
            }

            // 動画出力がある場合
            if (output.videoUrl) {
              const insertData: any = {
                user_id: user.id,
                workflow_id: workflowId,
                output_type: 'video',
                content_url: output.videoUrl,
                prompt: prompt,
                metadata: {
                  nodeId,
                  nodeType,
                  nodeName: node?.data?.config?.name,
                },
              };

              savePromises.push(
                supabase.from('workflow_outputs').insert(insertData).select()
              );
            }
          } else if (nodeType === 'gemini') {
            // Geminiノード: テキストまたは画像
            if (output.imageData || output.storagePath) {
              const insertData: any = {
                user_id: user.id,
                workflow_id: workflowId,
                output_type: 'image',
                content_url: output.storagePath || null,
                prompt: prompt,
                metadata: {
                  nodeId,
                  nodeType,
                  nodeName: node?.data?.config?.name,
                },
              };

              savePromises.push(
                supabase.from('workflow_outputs').insert(insertData).select()
              );
            } else if (output.response) {
              const insertData: any = {
                user_id: user.id,
                workflow_id: workflowId,
                output_type: 'text',
                content_text: output.response,
                prompt: prompt,
                metadata: {
                  nodeId,
                  nodeType,
                  nodeName: node?.data?.config?.name,
                },
              };

              savePromises.push(
                supabase.from('workflow_outputs').insert(insertData).select()
              );
            }
          } else if (nodeType === 'elevenlabs') {
            // 音声生成ノード
            if (output.audioData) {
              // 音声データはbase64形式なので、そのまま保存するか、URLに変換する必要があります
              // ここでは簡易的にmetadataに保存
              const insertData: any = {
                user_id: user.id,
                workflow_id: workflowId,
                output_type: 'audio',
                content_text: 'Audio data (base64)',
                prompt: prompt,
                metadata: {
                  nodeId,
                  nodeType,
                  nodeName: node?.data?.config?.name,
                  hasAudioData: true,
                },
              };

              savePromises.push(
                supabase.from('workflow_outputs').insert(insertData).select()
              );
            }
          }
          // inputやimageInputノードは保存しない（入力データなので）
        });

        // 全ての保存処理を並列実行
        if (savePromises.length > 0) {
          await Promise.all(savePromises);
          console.log(`Saved ${savePromises.length} outputs to database`);
        }
      }
    } catch (saveError: any) {
      // 保存エラーはログのみで、実行結果は返す
      console.error('Failed to save outputs to database:', saveError);
    }

    return NextResponse.json({
      success: true,
      workflowId,
      workflowName: workflow.name,
      outputs,
      executionTime: Date.now(),
    });

  } catch (error: any) {
    console.error('========================================');
    console.error('Workflow execution API error');
    console.error('========================================');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error code:', error.code);
    console.error('Error cause:', error.cause);
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error('Workflow ID:', workflowId);
    console.error('Workflow name:', workflow?.name);
    console.error('========================================');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute workflow',
        details: error.message,
        errorType: error.constructor.name,
        errorCode: error.code,
        errorCause: error.cause?.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
