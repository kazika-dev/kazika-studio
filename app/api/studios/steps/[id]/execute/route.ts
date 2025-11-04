import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStepById, getBoardById, getStudioById, updateStep, getStepsByBoardId, getWorkflowById, createWorkflowOutput } from '@/lib/db';
import { executeWorkflow } from '@/lib/workflow/executor';
import { Node } from 'reactflow';

/**
 * POST /api/studios/steps/[id]/execute
 * 個別ステップを実行
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

    try {
      console.log(`Executing individual step ${step.id}: workflow ${step.workflow_id}`);

      // ステータスを実行中に更新
      await updateStep(step.id, { execution_status: 'running' });

      // ワークフローをDBから取得
      const workflow = await getWorkflowById(step.workflow_id);
      if (!workflow) {
        throw new Error(`Workflow ${step.workflow_id} not found`);
      }

      // ワークフローのノードとエッジを取得
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

      // 前のステップの出力を取得
      const previousOutputs = await getPreviousStepOutputs(step);

      // 入力を構築してノードに適用
      const inputs = buildInputs(step, previousOutputs, board);
      applyInputsToNodes(nodes, inputs, workflow);

      // ワークフローを実行
      const result = await executeWorkflow(nodes, edges);

      if (result.success) {
        // 成功: 出力を保存
        const outputData: any = {};
        const executionRequests: any = {}; // 実行時のリクエストデータ

        console.log('=== Step execution result processing ===');
        console.log('Result success:', result.success);
        console.log('Result count:', result.results.size);

        result.results.forEach((execResult, nodeId) => {
          console.log(`Node ${nodeId}:`, {
            success: execResult.success,
            hasOutput: !!execResult.output,
            hasRequestBody: !!execResult.requestBody,
            requestBody: execResult.requestBody,
          });

          outputData[nodeId] = execResult.output;

          // 実行時のリクエストボディを保存（プロンプトなど）
          if (execResult.requestBody) {
            executionRequests[nodeId] = execResult.requestBody;
          }
        });

        console.log('Execution requests to save:', JSON.stringify(executionRequests, null, 2));
        console.log('Current step metadata:', step.metadata);

        const metadataToSave = {
          ...(step.metadata || {}),
          execution_requests: executionRequests,
        };

        console.log('Metadata to save:', JSON.stringify(metadataToSave, null, 2));

        const updatedStep = await updateStep(step.id, {
          execution_status: 'completed',
          output_data: outputData,
          error_message: null,
          // metadataに実行リクエストを保存
          metadata: metadataToSave,
        });

        console.log('Updated step metadata after save:', updatedStep.metadata);
        console.log('Saved execution requests:', executionRequests);

        // workflow_outputsテーブルに出力を保存（ステップ詳細記録用）
        console.log('Saving outputs to workflow_outputs table (step details)...');
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
              console.log(`Saved image output for node ${nodeId}`);
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
              console.log(`Saved image URL output for node ${nodeId}`);
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
              console.log(`Saved video output for node ${nodeId}`);
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
              console.log(`Saved audio output for node ${nodeId}`);
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
              console.log(`Saved text output for node ${nodeId}`);
            }
          }
          console.log('All outputs saved to workflow_outputs table (step details)');
        } catch (outputError: any) {
          console.error('Failed to save outputs to workflow_outputs:', outputError);
          // 出力保存の失敗はワークフロー実行の成功に影響しない
        }

        // アウトプット一覧(/outputs)に表示するための保存
        console.log('Saving outputs for /outputs page...');
        console.log('Current user:', user?.id);
        try {
          if (user) {
            // 最終ノードを特定（出力エッジがないノード）
            const sourceNodeIds = new Set(edges.map((e: any) => e.source));
            const finalNodeIds = nodes
              .map((n: Node) => n.id)
              .filter((id: string) => !sourceNodeIds.has(id));

            console.log('Final nodes to save for /outputs:', finalNodeIds);

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
                const contentUrl = output.storagePath || output.imageUrl;
                if (contentUrl) {
                  const insertData: any = {
                    user_id: user.id,
                    workflow_id: step.workflow_id,
                    output_type: 'image',
                    content_url: contentUrl,
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
                } else {
                  console.log(`Skipping image output for node ${nodeId} - no content_url available`);
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
                const contentUrl = output.storagePath;
                if (contentUrl) {
                  const insertData: any = {
                    user_id: user.id,
                    workflow_id: step.workflow_id,
                    output_type: 'image',
                    content_url: contentUrl,
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
                  // 音声データはbase64形式なので、そのまま保存するか、URLに変換する必要があります
                  // ここでは簡易的にmetadataに保存
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
              // inputやimageInputノードは保存しない（入力データなので）
            });

            // 全ての保存処理を並列実行
            if (savePromises.length > 0) {
              await Promise.all(savePromises);
              console.log(`Saved ${savePromises.length} outputs to /outputs page`);
            }
          }
        } catch (outputPageError: any) {
          // 保存エラーはログのみで、実行結果は返す
          console.error('Failed to save outputs for /outputs page:', outputPageError);
          console.error('Error details:', {
            message: outputPageError.message,
            stack: outputPageError.stack,
            name: outputPageError.name,
          });
        }

        console.log(`Step ${step.id} completed successfully`);

        return NextResponse.json({
          success: true,
          step: updatedStep,
        });
      } else {
        // 失敗: エラーを記録
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

        return NextResponse.json(
          {
            success: false,
            error: `Step execution failed: ${result.error}`,
            details: detailedErrorMessage,
          },
          { status: 500 }
        );
      }
    } catch (error: any) {
      console.error('Step execution error:', error);

      // ステータスを失敗に更新
      await updateStep(step.id, {
        execution_status: 'failed',
        error_message: error.message,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to execute step',
          details: error.message,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Step execution error:', error);
    return NextResponse.json(
      { error: 'Failed to execute step', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * 前のステップの出力を取得
 */
async function getPreviousStepOutputs(currentStep: any) {
  const allSteps = await getStepsByBoardId(currentStep.board_id);

  // 現在のステップより前のステップの出力を集約
  const previousOutputs: any = {};

  for (const step of allSteps) {
    // 現在のステップより前で、完了済みのステップのみ
    if (step.step_order < currentStep.step_order && step.execution_status === 'completed') {
      // 出力データをマージ
      if (step.output_data) {
        Object.assign(previousOutputs, step.output_data);
      }
    }
  }

  return previousOutputs;
}

/**
 * ノードに入力を適用
 */
function applyInputsToNodes(nodes: Node[], inputs: any, workflow: any) {
  console.log('=== applyInputsToNodes called ===');
  console.log('Inputs:', JSON.stringify(inputs, null, 2));
  console.log('Number of nodes:', nodes.length);
  console.log('Workflow form_config:', JSON.stringify(workflow?.form_config, null, 2));

  if (!inputs || Object.keys(inputs).length === 0) {
    console.log('No inputs to apply');
    return;
  }

  // form_configからフィールドタイプのマップを作成
  const fieldTypeMap: Record<string, string> = {};
  if (workflow?.form_config?.fields) {
    workflow.form_config.fields.forEach((field: any) => {
      fieldTypeMap[field.name] = field.type;
    });
  }
  console.log('Field type map:', fieldTypeMap);

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
      console.log(`Added previous image to imageFields (storagePath: ${imgOutput.storagePath})`);
    });
  }

  console.log(`Found ${imageInputNodes.length} imageInput nodes and ${imageFields.length} image fields`);

  // imageInputノードに画像フィールドを順番に割り当て
  const assignedImageFields = new Set<string>();
  imageInputNodes.forEach((node, index) => {
    if (imageFields[index]) {
      const { fieldName, fieldValue, fieldType, storagePath } = imageFields[index];
      console.log(`Assigning image field ${fieldName} to imageInput node ${node.id}`);

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
        console.log(`Set storagePath for imageInput node ${node.id}: ${storagePath}`);
      }

      if (fieldName !== 'previousImage') {
        assignedImageFields.add(fieldName);
      }
    }
  });

  // その他のノードに入力を適用
  nodes.forEach((node: Node) => {
    const nodeType = node.data.type;
    console.log(`Processing node ${node.id} (type: ${nodeType})`);
    console.log('Node config before:', JSON.stringify(node.data.config, null, 2));

    // プロンプトを持つノード
    if (['gemini', 'nanobana', 'higgsfield', 'seedream4', 'elevenlabs'].includes(nodeType)) {
      if (inputs.prompt) {
        console.log(`Applying prompt to node ${node.id}`);
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
      console.log(`Skipping imageInput node ${node.id} - already processed`);
    }

    // 入力ノード
    if (nodeType === 'input') {
      if (inputs.text) {
        console.log(`Applying text to input node ${node.id}`);
        node.data.config = {
          ...node.data.config,
          value: inputs.text,
        };
      }
    }

    // ワークフロー入力を動的に適用（imageInputノードには画像以外を適用）
    if (inputs.workflowInputs) {
      console.log(`Applying workflowInputs to node ${node.id}:`, inputs.workflowInputs);

      Object.entries(inputs.workflowInputs).forEach(([fieldName, fieldValue]) => {
        console.log(`  Processing field ${fieldName} (type: ${fieldTypeMap[fieldName]})`);

        if (fieldValue !== undefined && fieldValue !== null) {
          const fieldType = fieldTypeMap[fieldName];

          // 画像フィールドでimageInputノードに既に割り当て済みの場合はスキップ
          if ((fieldType === 'image' || fieldType === 'images') && nodeType === 'imageInput') {
            console.log(`  Skipping image field ${fieldName} for imageInput node (already assigned)`);
            return;
          }

          // promptまたはtextareaフィールドは既存のプロンプトに追加
          if (fieldType === 'prompt' || fieldType === 'textarea' || fieldName === 'prompt') {
            const existingPrompt = node.data.config?.prompt || '';
            const newPrompt = existingPrompt ? `${existingPrompt}\n${fieldValue}` : fieldValue;
            console.log(`  Appending prompt: "${existingPrompt}" + "${fieldValue}" = "${newPrompt}"`);
            node.data.config = {
              ...node.data.config,
              prompt: newPrompt,
            };
          }
          // 画像フィールド（imageInputノード以外）
          else if (fieldType === 'image' && nodeType !== 'imageInput') {
            console.log(`  Mapping image field ${fieldName} to imageData`);
            node.data.config = {
              ...node.data.config,
              imageData: fieldValue,
            };
          }
          // 複数画像フィールド（imageInputノード以外）
          else if (fieldType === 'images' && nodeType !== 'imageInput') {
            console.log(`  Mapping images field ${fieldName} to imageData and images`);
            node.data.config = {
              ...node.data.config,
              imageData: Array.isArray(fieldValue) && fieldValue.length > 0 ? fieldValue[0] : null,
              images: fieldValue,
            };
          }
          // その他のフィールドは直接設定
          else if (fieldType !== 'image' && fieldType !== 'images') {
            console.log(`  Setting ${fieldName} directly`);
            node.data.config = {
              ...node.data.config,
              [fieldName]: fieldValue,
            };
          }
        }
      });
    }

    console.log('Node config after:', JSON.stringify(node.data.config, null, 2));
  });
}

/**
 * 入力を構築
 */
function buildInputs(step: any, previousOutputs: any, board: any) {
  console.log('=== buildInputs called ===');
  console.log('Step ID:', step.id);
  console.log('Step input_config:', JSON.stringify(step.input_config, null, 2));

  const inputs: any = {};
  const config = step.input_config || {};

  // プロンプトを使用
  if (config.usePrompt) {
    console.log('Using custom prompt');
    inputs.prompt = config.prompt || board.prompt_text || '';
  }

  // 前のステップの出力から画像、動画、音声を探す
  if (config.usePreviousImage || config.usePreviousVideo || config.usePreviousAudio || config.usePreviousText) {
    console.log('Using previous step outputs');
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
          console.log(`Added previous image from node ${nodeId} (storagePath: ${nodeOutput.storagePath})`);
        }
      }

      // 動画を使用
      if (config.usePreviousVideo && nodeOutput.videoUrl) {
        inputs.videoUrl = nodeOutput.videoUrl;
        console.log(`Added previous video from node ${nodeId}`);
      }

      // 音声を使用
      if (config.usePreviousAudio && nodeOutput.audioData) {
        inputs.audioData = nodeOutput.audioData;
        console.log(`Added previous audio from node ${nodeId}`);
      }

      // テキストを使用
      if (config.usePreviousText && nodeOutput.text) {
        inputs.text = nodeOutput.text;
        console.log(`Added previous text from node ${nodeId}`);
      }
    }
  }

  // ワークフロー入力を追加
  if (config.workflowInputs) {
    console.log('Adding workflowInputs:', JSON.stringify(config.workflowInputs, null, 2));
    inputs.workflowInputs = config.workflowInputs;
  } else {
    console.log('No workflowInputs in config');
  }

  console.log('Built inputs for step:', JSON.stringify(inputs, null, 2));
  return inputs;
}
