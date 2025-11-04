import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBoardById, getStudioById, getStepsByBoardId, updateStep, updateBoard, getWorkflowById, createWorkflowOutput } from '@/lib/db';
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
        applyInputsToNodes(nodes, inputs, workflow);

        // ワークフローを実行
        const result = await executeWorkflow(nodes, edges);

        if (result.success) {
          // 成功: 出力を保存
          // results (Map) をオブジェクトに変換
          const outputData: any = {};
          const executionRequests: any = {}; // 実行時のリクエストデータ

          result.results.forEach((execResult, nodeId) => {
            outputData[nodeId] = execResult.output;

            // 実行時のリクエストボディを保存（プロンプトなど）
            if (execResult.requestBody) {
              executionRequests[nodeId] = execResult.requestBody;
            }
          });

          const updatedStep = await updateStep(step.id, {
            execution_status: 'completed',
            output_data: outputData,
            error_message: null,
            // metadataに実行リクエストを保存
            metadata: {
              ...step.metadata,
              execution_requests: executionRequests,
            },
          });

          executedSteps.push(updatedStep);

          // workflow_outputsテーブルに出力を保存（ステップ詳細記録用）
          try {
            for (const [nodeId, execResult] of result.results.entries()) {
              const output = execResult.output;
              if (!output) continue;

              // 画像出力
              if (output.imageData) {
                await createWorkflowOutput({
                  workflow_id: step.workflow_id,
                  step_id: step.id,
                  output_type: 'image',
                  node_id: nodeId,
                  output_data: output.imageData,
                  metadata: {
                    storagePath: output.storagePath,
                    nodeId: output.nodeId,
                  },
                });
              }

              // 画像URL出力
              if (output.imageUrl) {
                await createWorkflowOutput({
                  workflow_id: step.workflow_id,
                  step_id: step.id,
                  output_type: 'image',
                  node_id: nodeId,
                  output_url: output.imageUrl,
                  metadata: {
                    jobId: output.jobId,
                    nodeId: output.nodeId,
                  },
                });
              }

              // 動画出力
              if (output.videoUrl) {
                await createWorkflowOutput({
                  workflow_id: step.workflow_id,
                  step_id: step.id,
                  output_type: 'video',
                  node_id: nodeId,
                  output_url: output.videoUrl,
                  metadata: {
                    jobId: output.jobId,
                    duration: output.duration,
                    nodeId: output.nodeId,
                  },
                });
              }

              // 音声出力
              if (output.audioData) {
                await createWorkflowOutput({
                  workflow_id: step.workflow_id,
                  step_id: step.id,
                  output_type: 'audio',
                  node_id: nodeId,
                  output_data: output.audioData,
                  metadata: {
                    nodeId: output.nodeId,
                  },
                });
              }

              // テキスト出力
              if (output.response) {
                await createWorkflowOutput({
                  workflow_id: step.workflow_id,
                  step_id: step.id,
                  output_type: 'text',
                  node_id: nodeId,
                  output_data: { response: output.response },
                  metadata: {
                    nodeId: output.nodeId,
                  },
                });
              }
            }
          } catch (outputError: any) {
            console.error('Failed to save outputs to workflow_outputs:', outputError);
            // 出力保存の失敗はワークフロー実行の成功に影響しない
          }

          // アウトプット一覧(/outputs)に表示するための保存
          console.log('Saving outputs for /outputs page...');
          console.log('Current user:', user?.id);
          try {
            // 最終ノードを特定（出力エッジがないノード）
            const sourceNodeIds = new Set(edges.map((e: any) => e.source));
            const finalNodeIds = nodes
              .map((n: Node) => n.id)
              .filter((id: string) => !sourceNodeIds.has(id));

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
                if (output.imageData || output.storagePath || output.imageUrl) {
                  const insertData: any = {
                    user_id: user.id,
                    workflow_id: step.workflow_id,
                    output_type: 'image',
                    content_url: output.storagePath || output.imageUrl || null,
                    prompt: prompt,
                    metadata: {
                      nodeId,
                      nodeType,
                      nodeName: node?.data?.config?.name,
                      aspectRatio: node?.data?.config?.aspectRatio,
                      stepId: step.id,
                      boardId: step.board_id,
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
                    workflow_id: step.workflow_id,
                    output_type: 'video',
                    content_url: output.videoUrl,
                    prompt: prompt,
                    metadata: {
                      nodeId,
                      nodeType,
                      nodeName: node?.data?.config?.name,
                      stepId: step.id,
                      boardId: step.board_id,
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
                    workflow_id: step.workflow_id,
                    output_type: 'image',
                    content_url: output.storagePath || null,
                    prompt: prompt,
                    metadata: {
                      nodeId,
                      nodeType,
                      nodeName: node?.data?.config?.name,
                      stepId: step.id,
                      boardId: step.board_id,
                    },
                  };

                  savePromises.push(
                    supabase.from('workflow_outputs').insert(insertData).select()
                  );
                } else if (output.response) {
                  const insertData: any = {
                    user_id: user.id,
                    workflow_id: step.workflow_id,
                    output_type: 'text',
                    content_text: output.response,
                    prompt: prompt,
                    metadata: {
                      nodeId,
                      nodeType,
                      nodeName: node?.data?.config?.name,
                      stepId: step.id,
                      boardId: step.board_id,
                    },
                  };

                  savePromises.push(
                    supabase.from('workflow_outputs').insert(insertData).select()
                  );
                }
              } else if (nodeType === 'elevenlabs') {
                // 音声生成ノード
                if (output.audioData) {
                  const insertData: any = {
                    user_id: user.id,
                    workflow_id: step.workflow_id,
                    output_type: 'audio',
                    content_text: 'Audio data (base64)',
                    prompt: prompt,
                    metadata: {
                      nodeId,
                      nodeType,
                      nodeName: node?.data?.config?.name,
                      hasAudioData: true,
                      stepId: step.id,
                      boardId: step.board_id,
                    },
                  };

                  savePromises.push(
                    supabase.from('workflow_outputs').insert(insertData).select()
                  );
                }
              }
            });

            // 全ての保存処理を並列実行
            if (savePromises.length > 0) {
              await Promise.all(savePromises);
            }
          } catch (outputPageError: any) {
            console.error('Failed to save outputs for /outputs page:', outputPageError);
            console.error('Error details:', {
              message: outputPageError.message,
              stack: outputPageError.stack,
              name: outputPageError.name,
            });
          }

          // 次のステップのために出力を保持
          previousOutputs = { ...previousOutputs, ...outputData };

          console.log(`Step ${step.step_order} completed successfully`);
        } else {
          // 失敗: エラーを記録して中断
          // 失敗したノードの詳細を取得
          let detailedErrorMessage = result.error || 'Unknown error';

          // 失敗したノードを探す
          for (const [nodeId, execResult] of result.results.entries()) {
            if (!execResult.success && execResult.error) {
              detailedErrorMessage = execResult.error;

              // APIエラーの詳細がある場合は追加
              if (execResult.errorDetails) {
                const errorDetails = execResult.errorDetails;

                // Nanobana APIのエラー形式
                if (errorDetails.message) {
                  detailedErrorMessage += `\n\n詳細: ${errorDetails.message}`;
                }

                // その他のエラー詳細をJSON形式で追加
                if (errorDetails.finishReason || errorDetails.error) {
                  const additionalInfo: string[] = [];
                  if (errorDetails.finishReason) {
                    additionalInfo.push(`終了理由: ${errorDetails.finishReason}`);
                  }
                  if (errorDetails.error && errorDetails.error !== errorDetails.message) {
                    additionalInfo.push(`エラー: ${errorDetails.error}`);
                  }
                  if (additionalInfo.length > 0) {
                    detailedErrorMessage += `\n${additionalInfo.join('\n')}`;
                  }
                }
              }
              break; // 最初の失敗したノードのみ処理
            }
          }

          await updateStep(step.id, {
            execution_status: 'failed',
            error_message: detailedErrorMessage,
          });

          // ボードのステータスをエラーに更新
          await updateBoard(boardId, {
            status: 'error',
            error_message: `Step ${step.step_order} failed: ${detailedErrorMessage}`,
          });

          return NextResponse.json(
            {
              success: false,
              error: `Step ${step.step_order} failed: ${result.error}`,
              details: detailedErrorMessage,
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
function applyInputsToNodes(nodes: Node[], inputs: any, workflow: any) {
  if (!inputs || Object.keys(inputs).length === 0) {
    return;
  }

  // form_configからフィールドタイプのマップを作成
  const fieldTypeMap: Record<string, string> = {};
  if (workflow?.form_config?.fields) {
    workflow.form_config.fields.forEach((field: any) => {
      fieldTypeMap[field.name] = field.type;
    });
  }

  // imageInputノードと画像フィールドを収集して、順番に割り当てる
  const imageInputNodes = nodes.filter(n => n.data.type === 'imageInput');
  const imageFields: Array<{ fieldName: string; fieldValue: any; fieldType: string; storagePath?: string }> = [];

  if (inputs.workflowInputs) {
    Object.entries(inputs.workflowInputs).forEach(([fieldName, fieldValue]) => {
      const fieldType = fieldTypeMap[fieldName];
      if ((fieldType === 'image' || fieldType === 'images') && fieldValue) {
        imageFields.push({ fieldName, fieldValue, fieldType });
      }
    });
  }

  // 前のステップの画像も追加
  if (inputs.previousImages && Array.isArray(inputs.previousImages)) {
    inputs.previousImages.forEach((imgOutput: any) => {
      imageFields.push({
        fieldName: 'previousImage',
        fieldValue: imgOutput.imageData,
        fieldType: 'image',
        storagePath: imgOutput.storagePath, // storagePathを保持
      });
    });
  }

  // imageInputノードに画像フィールドを順番に割り当て
  const assignedImageFields = new Set<string>();
  imageInputNodes.forEach((node, index) => {
    if (imageFields[index]) {
      const { fieldName, fieldValue, fieldType, storagePath } = imageFields[index];

      if (fieldType === 'images' && Array.isArray(fieldValue) && fieldValue.length > 0) {
        node.data.config = {
          ...node.data.config,
          imageData: fieldValue[0],
          images: fieldValue,
        };
      } else {
        node.data.config = {
          ...node.data.config,
          imageData: fieldValue,
        };
      }

      // storagePathがある場合は設定（前のステップの画像）
      if (storagePath) {
        node.data.config = {
          ...node.data.config,
          storagePath: storagePath,
        };
      }

      if (fieldName !== 'previousImage') {
        assignedImageFields.add(fieldName);
      }
    }
  });

  // その他のノードに入力を適用
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

    // 画像入力ノード（既に処理済みなのでスキップ）
    if (nodeType === 'imageInput') {
      // 既に処理済み
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

    // ワークフロー入力を動的に適用（imageInputノードには画像以外を適用）
    if (inputs.workflowInputs) {
      Object.entries(inputs.workflowInputs).forEach(([fieldName, fieldValue]) => {
        if (fieldValue !== undefined && fieldValue !== null) {
          const fieldType = fieldTypeMap[fieldName];

          // 画像フィールドでimageInputノードに既に割り当て済みの場合はスキップ
          if ((fieldType === 'image' || fieldType === 'images') && nodeType === 'imageInput') {
            return;
          }

          // promptまたはtextareaフィールドは既存のプロンプトに追加
          if (fieldType === 'prompt' || fieldType === 'textarea' || fieldName === 'prompt') {
            const existingPrompt = node.data.config?.prompt || '';
            const newPrompt = existingPrompt ? `${existingPrompt}\n${fieldValue}` : fieldValue;
            node.data.config = {
              ...node.data.config,
              prompt: newPrompt,
            };
          }
          // 画像フィールド（imageInputノード以外）
          else if (fieldType === 'image' && nodeType !== 'imageInput') {
            node.data.config = {
              ...node.data.config,
              imageData: fieldValue,
            };
          }
          // 複数画像フィールド（imageInputノード以外）
          else if (fieldType === 'images' && nodeType !== 'imageInput') {
            node.data.config = {
              ...node.data.config,
              imageData: Array.isArray(fieldValue) && fieldValue.length > 0 ? fieldValue[0] : null,
              images: fieldValue,
            };
          }
          // その他のフィールドは直接設定
          else if (fieldType !== 'image' && fieldType !== 'images') {
            node.data.config = {
              ...node.data.config,
              [fieldName]: fieldValue,
            };
          }
        }
      });
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

      // 画像を使用（画像データまたはstoragePathがある場合）
      if (config.usePreviousImage) {
        // imageDataとstoragePathの両方を保持
        if (nodeOutput.imageData || nodeOutput.storagePath) {
          inputs.previousImages = inputs.previousImages || [];
          inputs.previousImages.push({
            imageData: nodeOutput.imageData,
            storagePath: nodeOutput.storagePath,
            imageUrl: nodeOutput.imageUrl,
          });
        }
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

  // ワークフロー入力を追加
  if (config.workflowInputs) {
    inputs.workflowInputs = config.workflowInputs;
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
