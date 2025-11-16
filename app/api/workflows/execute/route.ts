import { NextRequest, NextResponse } from 'next/server';
import { executeWorkflow } from '@/lib/workflow/executor';
import { getWorkflowById, getCharacterSheetById } from '@/lib/db';
import { Node } from 'reactflow';
import { createClient } from '@/lib/supabase/server';
import { uploadImageToStorage } from '@/lib/gcp-storage';

// Next.jsのルートハンドラの設定（ワークフロー実行は時間がかかる可能性がある）
export const maxDuration = 300; // 5分（秒単位）- Vercel hobby plan limit

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
    // DBから取得したデータは文字列の場合があるのでパース
    let nodes = workflow.nodes;
    let edges = workflow.edges;

    if (typeof nodes === 'string') {
      try {
        nodes = JSON.parse(nodes);
      } catch (e) {
        return NextResponse.json(
          { error: `Failed to parse workflow nodes: ${e}` },
          { status: 500 }
        );
      }
    }

    if (typeof edges === 'string') {
      try {
        edges = JSON.parse(edges);
      } catch (e) {
        return NextResponse.json(
          { error: `Failed to parse workflow edges: ${e}` },
          { status: 500 }
        );
      }
    }

    nodes = nodes || [];
    edges = edges || [];

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
      for (const node of nodes) {
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

            const fieldValue = inputs[fieldName];

            // fieldValueがstoragePathの文字列の場合（DynamicFormFieldで保存された画像）
            if (typeof fieldValue === 'string') {
              // storagePathを設定（executorでGCP Storageから取得）
              node.data.config = {
                ...node.data.config,
                storagePath: fieldValue,
              };
              console.log(`  Set storagePath: ${fieldValue}`);
            }
            // 配列の場合（複数画像）
            else if (Array.isArray(fieldValue) && fieldValue.length > 0) {
              const isStoragePaths = fieldValue.every(item => typeof item === 'string');
              if (isStoragePaths) {
                // storagePathの配列の場合、最初のpathを設定
                node.data.config = {
                  ...node.data.config,
                  storagePath: fieldValue[0],
                };
                console.log(`  Set storagePath from array: ${fieldValue[0]}`);
              } else {
                // imageDataオブジェクトの配列の場合（レガシー）
                node.data.config = {
                  ...node.data.config,
                  imageData: fieldValue[0],
                };
              }
            }
            // imageDataオブジェクトの場合（レガシー）
            else if (fieldValue && typeof fieldValue === 'object' && fieldValue.mimeType && fieldValue.data) {
              node.data.config = {
                ...node.data.config,
                imageData: fieldValue,
              };
            }
          }
          // 後方互換性: inputs.images も確認
          else if (inputs.images) {
            const imageInputNodes = nodes.filter((n: Node) => n.data.type === 'imageInput');
            const nodeIndex = imageInputNodes.findIndex((n: Node) => n.id === nodeId);

            if (nodeIndex >= 0 && inputs.images[nodeIndex]) {
              console.log(`✓ Setting imageInput node ${nodeId} from inputs.images[${nodeIndex}]`);

              const imageValue = inputs.images[nodeIndex];

              // storagePathの文字列かimageDataオブジェクトか判定
              if (typeof imageValue === 'string') {
                node.data.config = {
                  ...node.data.config,
                  storagePath: imageValue,
                };
              } else {
                node.data.config = {
                  ...node.data.config,
                  imageData: imageValue,
                };
              }
            } else {
              console.log(`✗ Image not found at index ${nodeIndex} for imageInput node ${nodeId}`);
            }
          } else {
            console.log(`✗ No matching image field found for imageInput node ${nodeId}`);
          }
        }

        // プロンプトを持つノード: {nodeType}_prompt_{nodeId} フィールドから値を取得
        if (['gemini', 'nanobana', 'higgsfield', 'seedream4'].includes(nodeType)) {
          const promptFieldName = `${nodeType}_prompt_${nodeId}`;
          const characterSheetsFieldName = `${nodeType}_characterSheets_${nodeId}`;

          console.log(`Processing ${nodeType} node ${nodeId} prompt:`, {
            promptFieldName,
            hasPromptField: inputs[promptFieldName] !== undefined,
            hasPrompt: inputs.prompt !== undefined,
            currentPrompt: node.data.config?.prompt,
            hasPlaceholder: node.data.config?.prompt?.includes('{{input}}'),
          });

          if (inputs[promptFieldName] !== undefined) {
            const workflowPrompt = node.data.config?.prompt || '';
            const formPrompt = inputs[promptFieldName];
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

          // キャラクターシート配列の処理
          console.log(`Processing ${nodeType} node ${nodeId} characterSheets:`, {
            characterSheetsFieldName,
            hasField: inputs[characterSheetsFieldName] !== undefined,
            fieldValue: inputs[characterSheetsFieldName],
          });

          if (inputs[characterSheetsFieldName] !== undefined) {
            const characterSheetIds = inputs[characterSheetsFieldName];

            if (Array.isArray(characterSheetIds) && characterSheetIds.length > 0) {
              console.log(`✓ Loading ${characterSheetIds.length} character sheets for ${nodeType} node ${nodeId}`);

              try {
                const characterSheets = await Promise.all(
                  characterSheetIds.map(async (id: any) => {
                    const characterSheet = await getCharacterSheetById(parseInt(id));
                    if (characterSheet) {
                      console.log(`  ✓ Loaded character sheet: ${characterSheet.name} (ID: ${id})`);
                      return characterSheet;
                    } else {
                      console.error(`  ✗ Character sheet ${id} not found`);
                      return null;
                    }
                  })
                );

                const validCharacterSheets = characterSheets.filter(cs => cs !== null);

                node.data.config = {
                  ...node.data.config,
                  characterSheets: validCharacterSheets,
                };

                console.log(`✓ Successfully loaded ${validCharacterSheets.length} character sheets for ${nodeType} node ${nodeId}`);
              } catch (error) {
                console.error(`✗ Error loading character sheets for ${nodeType} node ${nodeId}:`, error);
              }
            }
          }
        }

        // Nanobanaノード: キャラクターシートと参照画像の処理
        if (nodeType === 'nanobana') {
          const characterSheetsFieldName = `nanobana_characterSheets_${nodeId}`;
          const referenceImagesFieldName = `nanobana_referenceImages_${nodeId}`;

          console.log(`Processing nanobana node ${nodeId}:`, {
            characterSheetsFieldName,
            referenceImagesFieldName,
            hasCharacterSheetsField: inputs[characterSheetsFieldName] !== undefined,
            hasReferenceImagesField: inputs[referenceImagesFieldName] !== undefined,
          });

          // キャラクターシートの処理
          if (inputs[characterSheetsFieldName] !== undefined) {
            const characterSheetIds = inputs[characterSheetsFieldName];
            console.log(`✓ Processing ${characterSheetIds.length} character sheet(s) for nanobana node ${nodeId}:`, characterSheetIds);

            node.data.config = {
              ...node.data.config,
              characterSheetIds: characterSheetIds,
            };
          }

          // 参照画像の処理
          if (inputs[referenceImagesFieldName] !== undefined) {
            const referenceImages = inputs[referenceImagesFieldName];
            console.log(`✓ Processing ${referenceImages.length} reference image(s) for nanobana node ${nodeId}`);

            node.data.config = {
              ...node.data.config,
              referenceImagePaths: referenceImages,
            };
          }
        }

        // Nanobanaノード: キャラクターシートの処理
        if (nodeType === 'nanobana') {
          const characterSheetsFieldName = `nanobana_characterSheets_${nodeId}`;
          console.log(`Processing nanobana node ${nodeId} characterSheets:`, {
            fieldName: characterSheetsFieldName,
            hasField: inputs[characterSheetsFieldName] !== undefined,
            currentCharacterSheets: node.data.config?.characterSheets,
          });

          if (inputs[characterSheetsFieldName] !== undefined) {
            const characterSheetIds = inputs[characterSheetsFieldName];
            console.log(`✓ Setting nanobana node ${nodeId} characterSheets with IDs:`, characterSheetIds);

            // キャラクターシート情報をDBから取得
            if (Array.isArray(characterSheetIds) && characterSheetIds.length > 0) {
              try {
                const characterSheets = await Promise.all(
                  characterSheetIds.map((id: string) => getCharacterSheetById(parseInt(id)))
                );

                // nullでないものだけフィルタ
                const validCharacterSheets = characterSheets.filter((cs) => cs !== null);

                if (validCharacterSheets.length > 0) {
                  node.data.config = {
                    ...node.data.config,
                    characterSheets: validCharacterSheets,
                  };
                  console.log(`✓ Successfully loaded ${validCharacterSheets.length} character sheets:`,
                    validCharacterSheets.map((cs) => cs.name)
                  );
                } else {
                  console.error(`✗ No valid character sheets found for IDs:`, characterSheetIds);
                }
              } catch (error) {
                console.error(`✗ Error loading character sheets:`, error);
              }
            } else {
              console.log(`✗ characterSheetIds is not a valid array:`, characterSheetIds);
            }
          } else {
            console.log(`✗ No matching characterSheets field found for nanobana node ${nodeId}`);
          }
        }

        // ElevenLabsノード: elevenlabs_text_{nodeId} と elevenlabs_voiceId_{nodeId} フィールドから値を取得
        if (nodeType === 'elevenlabs') {
          const textFieldName = `elevenlabs_text_${nodeId}`;
          const voiceIdFieldName = `elevenlabs_voiceId_${nodeId}`;

          console.log(`Processing elevenlabs node ${nodeId}:`, {
            textFieldName,
            voiceIdFieldName,
            hasTextField: inputs[textFieldName] !== undefined,
            hasVoiceIdField: inputs[voiceIdFieldName] !== undefined,
            currentText: node.data.config?.text,
            currentVoiceId: node.data.config?.voiceId,
          });

          // テキストフィールドの処理
          if (inputs[textFieldName] !== undefined) {
            const workflowText = node.data.config?.text || '';
            const formText = inputs[textFieldName];
            const combinedText = workflowText ? `${workflowText} ${formText}` : formText;

            console.log(`✓ Concatenating elevenlabs node ${nodeId} text:`);
            console.log(`  Workflow text: ${workflowText}`);
            console.log(`  Form text: ${formText}`);
            console.log(`  Combined: ${combinedText}`);

            node.data.config = {
              ...node.data.config,
              text: combinedText,
            };
          } else {
            console.log(`✗ No matching text field found for elevenlabs node ${nodeId}`);
          }

          // 音声IDフィールドの処理
          if (inputs[voiceIdFieldName] !== undefined) {
            console.log(`✓ Setting elevenlabs node ${nodeId} voiceId:`, inputs[voiceIdFieldName]);
            node.data.config = {
              ...node.data.config,
              voiceId: inputs[voiceIdFieldName],
            };
          } else {
            console.log(`✗ No matching voiceId field found for elevenlabs node ${nodeId}`);
          }
        }

        // キャラクターシートノード: characterSheet_{nodeId} フィールドからIDを取得
        if (nodeType === 'characterSheet') {
          const fieldName = `characterSheet_${nodeId}`;
          console.log(`Processing characterSheet node ${nodeId}:`, {
            fieldName,
            hasField: inputs[fieldName] !== undefined,
            currentCharacterSheet: node.data.config?.characterSheet,
          });

          if (inputs[fieldName] !== undefined) {
            const characterSheetId = inputs[fieldName];
            console.log(`✓ Setting characterSheet node ${nodeId} with ID:`, characterSheetId);

            // キャラクターシート情報をDBから取得
            try {
              const characterSheet = await getCharacterSheetById(characterSheetId);

              if (characterSheet) {
                node.data.config = {
                  ...node.data.config,
                  characterSheet: characterSheet,
                };
                console.log(`✓ Successfully loaded character sheet:`, characterSheet.name);
              } else {
                console.error(`✗ Character sheet ${characterSheetId} not found`);
              }
            } catch (error) {
              console.error(`✗ Error loading character sheet ${characterSheetId}:`, error);
            }
          } else {
            console.log(`✗ No matching characterSheet field found for characterSheet node ${nodeId}`);
          }
        }
      }

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

      // 実行結果をノードの設定に反映（画像生成ノードなど）
      if (node && nodeResult.success && nodeResult.output) {
        const output = nodeResult.output;

        // Popcornノード: imageUrlsを設定に反映
        if (node.data.type === 'popcorn' && output.imageUrls) {
          node.data.config = {
            ...node.data.config,
            imageUrls: output.imageUrls,
            status: 'success',
          };
          console.log(`Updated Popcorn node ${nodeId} config with ${output.imageUrls.length} images`);
        }
        // 他の画像生成ノードも同様に処理
        else if (node.data.type === 'nanobana' && output.imageData) {
          node.data.config = {
            ...node.data.config,
            imageData: output.imageData,
            status: 'success',
          };
        }
        else if (node.data.type === 'seedream4' && output.imageUrl) {
          node.data.config = {
            ...node.data.config,
            imageUrl: output.imageUrl,
            status: 'success',
          };
        }
      }
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
            if (output.imageData || output.storagePath || output.imageUrl) {
              const insertData: any = {
                user_id: user.id,
                workflow_id: workflowId,
                output_type: 'image',
                content_url: output.storagePath || output.imageUrl || null,
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
              // 音声データをGCP Storageにアップロード
              const audioData = output.audioData;
              const base64Data = typeof audioData === 'string' ? audioData : audioData.data;
              const mimeType = typeof audioData === 'string' ? 'audio/mpeg' : audioData.mimeType;

              console.log('Uploading ElevenLabs audio to GCP Storage:', {
                nodeId,
                nodeName: node?.data?.config?.name,
                mimeType,
                dataLength: base64Data.length,
              });

              // GCP Storageにアップロード
              const uploadPromise = (async () => {
                const storagePath = await uploadImageToStorage(base64Data, mimeType, undefined, 'audio');

                console.log('ElevenLabs audio uploaded to GCP Storage:', storagePath);

                const insertData: any = {
                  user_id: user.id,
                  workflow_id: workflowId,
                  output_type: 'audio',
                  content_url: storagePath,
                  prompt: nodeResult.requestBody?.text || node?.data?.config?.text || null,
                  metadata: {
                    nodeId,
                    nodeType,
                    nodeName: node?.data?.config?.name,
                    voiceId: nodeResult.requestBody?.voiceId || node?.data?.config?.voiceId,
                    modelId: nodeResult.requestBody?.modelId || node?.data?.config?.modelId,
                  },
                };

                return supabase.from('workflow_outputs').insert(insertData).select();
              })();

              savePromises.push(uploadPromise);
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
      nodes, // 更新されたノード設定を返す
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
