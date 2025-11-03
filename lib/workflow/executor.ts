import { Node, Edge } from 'reactflow';
import { getApiUrl } from '@/lib/utils/apiUrl';

export interface ExecutionResult {
  success: boolean;
  nodeId: string;
  input?: any;
  requestBody?: any;
  output: any;
  error?: string;
  errorDetails?: any; // APIから返された詳細なエラー情報
}

export interface WorkflowExecutionResult {
  success: boolean;
  results: Map<string, ExecutionResult>;
  error?: string;
}

/**
 * ログ出力用に画像データを省略する
 */
function sanitizeForLog(obj: any): any {
  if (!obj) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLog(item));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'imageData' && value) {
      sanitized[key] = '[IMAGE_DATA_OMITTED]';
    } else if (key === 'data' && typeof value === 'string' && value.length > 1000) {
      sanitized[key] = `[LARGE_DATA_OMITTED: ${value.length} bytes]`;
    } else if (typeof value === 'string' && value.length > 1000 && value.startsWith('data:image')) {
      sanitized[key] = '[BASE64_IMAGE_OMITTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeForLog(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * トポロジカルソートでワークフローの実行順序を決定
 */
export function topologicalSort(nodes: Node[], edges: Edge[]): string[] {
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  // グラフを初期化
  nodes.forEach((node) => {
    graph.set(node.id, []);
    inDegree.set(node.id, 0);
  });

  // エッジからグラフを構築
  edges.forEach((edge) => {
    graph.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  });

  // 入次数が0のノードをキューに追加
  const queue: string[] = [];
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });

  // トポロジカルソート実行
  const result: string[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    result.push(nodeId);

    graph.get(nodeId)?.forEach((neighbor) => {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);

      if (newDegree === 0) {
        queue.push(neighbor);
      }
    });
  }

  // 循環参照チェック
  if (result.length !== nodes.length) {
    throw new Error('Circular dependency detected in workflow');
  }

  return result;
}

/**
 * 個別ノードを実行
 */
async function executeNode(
  node: Node,
  previousResults: Map<string, ExecutionResult>,
  edges: Edge[],
  nodes: Node[]
): Promise<ExecutionResult> {
  // 入力データを収集（前ノードの出力）
  const inputData = collectInputData(node.id, edges, previousResults, nodes);
  let requestBody: any = undefined;

  try {
    const nodeType = node.data.type;

    let output: any;

    switch (nodeType) {
      case 'input':
        // 入力ノードは設定されたデータをそのまま出力
        output = {
          value: node.data.config?.value || '',
          nodeId: node.id,
        };
        break;

      case 'imageInput':
        // 画像入力ノードは画像データをそのまま出力
        const imageInputData = node.data.config?.imageData;

        // 画像データがある場合は、GCP Storageにアップロード
        let imageStoragePath: string | undefined;
        if (imageInputData && imageInputData.data && imageInputData.mimeType) {
          try {
            // クライアントサイドでのみGCP Storageにアップロード
            // サーバーサイド（API実行）では相対URLが使えないためスキップ
            if (typeof window !== 'undefined') {
              const uploadResponse = await fetch(getApiUrl('/api/upload-image'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  base64Data: imageInputData.data,
                  mimeType: imageInputData.mimeType,
                }),
              });

              if (uploadResponse.ok) {
                const uploadData = await uploadResponse.json();
                imageStoragePath = uploadData.storagePath;
                console.log('Image uploaded to storage:', imageStoragePath);
              }
            } else {
              console.log('Skipping image upload on server-side execution (using base64 data directly)');
            }
          } catch (error) {
            console.error('Failed to upload image to storage:', error);
            // エラーでも続行（base64データは引き続き利用可能）
          }
        }

        output = {
          imageData: imageInputData || null,
          storagePath: imageStoragePath, // GCP Storage パス
          nodeId: node.id,
        };
        break;

      case 'process':
        // 処理ノードは入力データを加工
        output = {
          value: inputData,
          processed: true,
          nodeId: node.id,
        };
        break;

      case 'output':
        // 出力ノードは入力データをそのまま出力
        output = {
          value: inputData,
          nodeId: node.id,
        };
        break;

      case 'gemini':
        // Gemini APIを呼び出し
        const geminiPrompt = replaceVariables(
          node.data.config?.prompt || '',
          inputData
        );

        // 入力データから画像を抽出
        const geminiImages = extractImagesFromInput(inputData);

        console.log('Gemini execution:', {
          nodeId: node.id,
          nodeName: node.data.config?.name,
          originalPrompt: node.data.config?.prompt,
          promptLength: (node.data.config?.prompt || '').length,
          inputData: sanitizeForLog(inputData),
          inputDataKeys: Object.keys(inputData),
          replacedPrompt: geminiPrompt,
          replacedPromptLength: geminiPrompt.length,
          imageCount: geminiImages.length,
        });

        if (!node.data.config?.prompt || !node.data.config.prompt.trim()) {
          throw new Error(`Geminiノード "${node.data.config?.name || node.id}" のプロンプトが設定されていません。ノードの設定を開いてプロンプトを入力し、保存してください。`);
        }

        if (!geminiPrompt.trim()) {
          throw new Error(`Geminiノード "${node.data.config?.name || node.id}" のプロンプト変数が置換できませんでした。元のプロンプト: "${node.data.config?.prompt}"`);
        }

        // リクエストボディを保存（画像がある場合は含める）
        requestBody = {
          prompt: geminiPrompt,
          model: node.data.config?.model || 'gemini-2.5-flash',
          images: geminiImages.length > 0 ? geminiImages : undefined,
        };

        const geminiResponse = await fetch(getApiUrl('/api/gemini'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const geminiData = await geminiResponse.json();

        if (!geminiResponse.ok) {
          const error: any = new Error(geminiData.error || 'Gemini API call failed');
          error.apiErrorDetails = geminiData; // API全体のエラーレスポンスを保存
          throw error;
        }

        output = {
          response: geminiData.response,
          nodeId: node.id,
        };
        break;

      case 'nanobana':
        // Nanobana APIを呼び出し
        let nanobanaPrompt = replaceVariables(
          node.data.config?.prompt || '',
          inputData
        );

        // 前のノードからのテキスト出力を自動的に追加
        const inputTexts: string[] = [];
        Object.values(inputData).forEach((input: any) => {
          if (input && typeof input === 'object') {
            // geminiノードからのresponseフィールドを追加
            if (input.response && typeof input.response === 'string') {
              inputTexts.push(input.response);
            }
            // その他のvalueフィールドを追加
            else if (input.value !== undefined && input.value !== null) {
              inputTexts.push(String(input.value));
            }
          }
        });

        // prompt欄の内容と前のノードの出力を組み合わせ
        if (inputTexts.length > 0) {
          const combinedText = inputTexts.join(' ');
          if (nanobanaPrompt.trim()) {
            nanobanaPrompt = (nanobanaPrompt + ' ' + combinedText).trim();
          } else {
            nanobanaPrompt = combinedText;
          }
        }

        // 入力データから画像を抽出（参照画像として使用、最大3枚）
        const nanobanaImages = extractImagesFromInput(inputData).slice(0, 3);

        console.log('Nanobana execution:', {
          nodeId: node.id,
          nodeName: node.data.config?.name,
          originalPrompt: node.data.config?.prompt,
          promptLength: (node.data.config?.prompt || '').length,
          inputData: sanitizeForLog(inputData),
          inputDataKeys: Object.keys(inputData),
          inputTexts,
          finalPrompt: nanobanaPrompt,
          finalPromptLength: nanobanaPrompt.length,
          imageCount: nanobanaImages.length,
        });

        if (!nanobanaPrompt.trim()) {
          throw new Error(`Nanobanaノード "${node.data.config?.name || node.id}" のプロンプトが空です。プロンプトを入力するか、前のノードから値を受け取ってください。`);
        }

        // リクエストボディを保存（参照画像がある場合は含める）
        requestBody = {
          prompt: nanobanaPrompt,
          aspectRatio: node.data.config?.aspectRatio || '1:1',
          referenceImages: nanobanaImages.length > 0 ? nanobanaImages : undefined,
        };

        const nanobanaResponse = await fetch(getApiUrl('/api/nanobana'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const nanobanaData = await nanobanaResponse.json();

        if (!nanobanaResponse.ok) {
          const error: any = new Error(nanobanaData.error || 'Nanobana API call failed');
          error.apiErrorDetails = nanobanaData; // API全体のエラーレスポンスを保存
          throw error;
        }

        output = {
          imageData: nanobanaData.imageData,
          storagePath: nanobanaData.storagePath, // GCP Storage内部パス
          nodeId: node.id,
        };
        break;

      case 'elevenlabs':
        // ElevenLabs Text-to-Speech APIを呼び出し
        let elevenLabsText = replaceVariables(
          node.data.config?.text || '',
          inputData
        );

        // 前のノードからのテキスト出力を自動的に追加
        const elevenLabsInputTexts: string[] = [];
        Object.values(inputData).forEach((input: any) => {
          if (input && typeof input === 'object') {
            // geminiノードからのresponseフィールドを追加
            if (input.response && typeof input.response === 'string') {
              elevenLabsInputTexts.push(input.response);
            }
            // その他のvalueフィールドを追加
            else if (input.value !== undefined && input.value !== null) {
              elevenLabsInputTexts.push(String(input.value));
            }
          }
        });

        // text欄の内容と前のノードの出力を組み合わせ
        if (elevenLabsInputTexts.length > 0) {
          const combinedText = elevenLabsInputTexts.join(' ');
          if (elevenLabsText.trim()) {
            elevenLabsText = (elevenLabsText + ' ' + combinedText).trim();
          } else {
            elevenLabsText = combinedText;
          }
        }

        console.log('ElevenLabs execution:', {
          nodeId: node.id,
          nodeName: node.data.config?.name,
          originalText: node.data.config?.text,
          textLength: (node.data.config?.text || '').length,
          inputData: sanitizeForLog(inputData),
          inputDataKeys: Object.keys(inputData),
          elevenLabsInputTexts,
          finalText: elevenLabsText,
          finalTextLength: elevenLabsText.length,
        });

        if (!elevenLabsText.trim()) {
          throw new Error(`ElevenLabsノード "${node.data.config?.name || node.id}" のテキストが空です。テキストを入力するか、前のノードから値を受け取ってください。`);
        }

        // リクエストボディを保存
        requestBody = {
          text: elevenLabsText,
          voiceId: node.data.config?.voiceId || 'JBFqnCBsd6RMkjVDRZzb',
          modelId: node.data.config?.modelId || 'eleven_multilingual_v2',
        };

        const elevenLabsResponse = await fetch(getApiUrl('/api/elevenlabs'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const elevenLabsData = await elevenLabsResponse.json();

        if (!elevenLabsResponse.ok) {
          const error: any = new Error(elevenLabsData.error || 'ElevenLabs API call failed');
          error.apiErrorDetails = elevenLabsData; // API全体のエラーレスポンスを保存
          throw error;
        }

        output = {
          audioData: elevenLabsData.audioData,
          nodeId: node.id,
        };
        break;

      case 'higgsfield':
        // Higgsfield Video Generation APIを呼び出し
        let higgsfieldPrompt = replaceVariables(
          node.data.config?.prompt || '',
          inputData
        );

        // 前のノードからのテキスト出力を自動的に追加
        const higgsfieldInputTexts: string[] = [];
        Object.values(inputData).forEach((input: any) => {
          if (input && typeof input === 'object') {
            // geminiノードからのresponseフィールドを追加
            if (input.response && typeof input.response === 'string') {
              higgsfieldInputTexts.push(input.response);
            }
            // その他のvalueフィールドを追加
            else if (input.value !== undefined && input.value !== null) {
              higgsfieldInputTexts.push(String(input.value));
            }
          }
        });

        // prompt欄の内容と前のノードの出力を組み合わせ
        if (higgsfieldInputTexts.length > 0) {
          const combinedText = higgsfieldInputTexts.join(' ');
          if (higgsfieldPrompt.trim()) {
            higgsfieldPrompt = (higgsfieldPrompt + ' ' + combinedText).trim();
          } else {
            higgsfieldPrompt = combinedText;
          }
        }

        console.log('Higgsfield execution:', {
          nodeId: node.id,
          nodeName: node.data.config?.name,
          originalPrompt: node.data.config?.prompt,
          promptLength: (node.data.config?.prompt || '').length,
          inputData: sanitizeForLog(inputData),
          inputDataKeys: Object.keys(inputData),
          higgsfieldInputTexts,
          finalPrompt: higgsfieldPrompt,
          finalPromptLength: higgsfieldPrompt.length,
        });

        if (!higgsfieldPrompt.trim()) {
          throw new Error(`Higgsfieldノード "${node.data.config?.name || node.id}" のプロンプトが空です。プロンプトを入力するか、前のノードから値を受け取ってください。`);
        }

        // 前のノードから画像のstoragePathを検索
        let inputImagePath: string | null = null;
        Object.values(inputData).forEach((input: any) => {
          if (input && typeof input === 'object' && input.storagePath) {
            inputImagePath = input.storagePath;
          }
        });

        // Higgsfieldは画像が必須
        if (!inputImagePath) {
          throw new Error(`Higgsfieldノード "${node.data.config?.name || node.id}" には参照画像が必要です。画像生成ノード（Nanobanaなど）または画像入力ノードを接続してください。`);
        }

        // リクエストボディを保存
        requestBody = {
          prompt: higgsfieldPrompt,
          duration: node.data.config?.duration || 5,
          cfgScale: node.data.config?.cfgScale || 0.5,
          enhancePrompt: node.data.config?.enhancePrompt || false,
          negativePrompt: node.data.config?.negativePrompt || '',
          inputImagePath: inputImagePath, // 画像パス（署名付きURL生成用）
        };

        const higgsfieldResponse = await fetch(getApiUrl('/api/higgsfield'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const higgsfieldData = await higgsfieldResponse.json();

        // 202 Accepted（処理中）の場合も成功として扱う
        if (!higgsfieldResponse.ok && higgsfieldResponse.status !== 202) {
          const error: any = new Error(higgsfieldData.error || 'Higgsfield API call failed');
          error.apiErrorDetails = higgsfieldData; // API全体のエラーレスポンスを保存
          throw error;
        }

        // 処理が完了した場合
        if (higgsfieldData.success && higgsfieldData.videoUrl) {
          output = {
            videoUrl: higgsfieldData.videoUrl,
            jobId: higgsfieldData.jobId,
            duration: higgsfieldData.duration,
            nodeId: node.id,
          };
        }
        // 処理中の場合
        else {
          output = {
            status: 'processing',
            message: higgsfieldData.message || '動画生成中です',
            jobSetId: higgsfieldData.jobSetId,
            jobId: higgsfieldData.jobId,
            dashboardUrl: higgsfieldData.dashboardUrl,
            note: higgsfieldData.note,
            nodeId: node.id,
          };
        }
        break;

      case 'seedream4':
        // Seedream4 Image Generation APIを呼び出し
        let seedream4Prompt = replaceVariables(
          node.data.config?.prompt || '',
          inputData
        );

        // 前のノードからのテキスト出力を自動的に追加
        const seedream4InputTexts: string[] = [];
        Object.values(inputData).forEach((input: any) => {
          if (input && typeof input === 'object') {
            // geminiノードからのresponseフィールドを追加
            if (input.response && typeof input.response === 'string') {
              seedream4InputTexts.push(input.response);
            }
            // その他のvalueフィールドを追加
            else if (input.value !== undefined && input.value !== null) {
              seedream4InputTexts.push(String(input.value));
            }
          }
        });

        // prompt欄の内容と前のノードの出力を組み合わせ
        if (seedream4InputTexts.length > 0) {
          const combinedText = seedream4InputTexts.join(' ');
          if (seedream4Prompt.trim()) {
            seedream4Prompt = (seedream4Prompt + ' ' + combinedText).trim();
          } else {
            seedream4Prompt = combinedText;
          }
        }

        // 前のノードから画像のstoragePathをすべて収集（最大8枚）
        const seedream4ImagePaths: string[] = [];
        Object.values(inputData).forEach((input: any) => {
          if (input && typeof input === 'object' && input.storagePath) {
            seedream4ImagePaths.push(input.storagePath);
          }
        });

        // 最大8枚まで
        const limitedImagePaths = seedream4ImagePaths.slice(0, 8);

        console.log('Seedream4 execution:', {
          nodeId: node.id,
          nodeName: node.data.config?.name,
          originalPrompt: node.data.config?.prompt,
          promptLength: (node.data.config?.prompt || '').length,
          inputData: sanitizeForLog(inputData),
          inputDataKeys: Object.keys(inputData),
          seedream4InputTexts,
          finalPrompt: seedream4Prompt,
          finalPromptLength: seedream4Prompt.length,
          imageCount: limitedImagePaths.length,
        });

        if (!seedream4Prompt.trim()) {
          throw new Error(`Seedream4ノード "${node.data.config?.name || node.id}" のプロンプトが空です。プロンプトを入力するか、前のノードから値を受け取ってください。`);
        }

        // Seedream4は画像が必須
        if (limitedImagePaths.length === 0) {
          throw new Error(`Seedream4ノード "${node.data.config?.name || node.id}" には少なくとも1枚の参照画像が必要です。画像生成ノード（Nanobanaなど）または画像入力ノードを接続してください。`);
        }

        // リクエストボディを保存
        requestBody = {
          prompt: seedream4Prompt,
          aspectRatio: node.data.config?.aspectRatio || '4:3',
          quality: node.data.config?.quality || 'basic',
          inputImagePaths: limitedImagePaths,
        };

        const seedream4Response = await fetch(getApiUrl('/api/seedream4'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const seedream4Data = await seedream4Response.json();

        // 202 Accepted（処理中）の場合も成功として扱う
        if (!seedream4Response.ok && seedream4Response.status !== 202) {
          const error: any = new Error(seedream4Data.error || 'Seedream4 API call failed');
          error.apiErrorDetails = seedream4Data; // API全体のエラーレスポンスを保存
          throw error;
        }

        // 処理が完了した場合
        if (seedream4Data.success && seedream4Data.imageUrl) {
          output = {
            imageUrl: seedream4Data.imageUrl,
            jobId: seedream4Data.jobId,
            nodeId: node.id,
          };
        }
        // 処理中の場合
        else {
          output = {
            status: 'processing',
            message: seedream4Data.message || '画像生成中です',
            jobSetId: seedream4Data.jobSetId,
            jobId: seedream4Data.jobId,
            dashboardUrl: seedream4Data.dashboardUrl,
            note: seedream4Data.note,
            nodeId: node.id,
          };
        }
        break;

      default:
        throw new Error(`Unknown node type: ${nodeType}`);
    }

    return {
      success: true,
      nodeId: node.id,
      input: inputData,
      requestBody,
      output,
    };
  } catch (error: any) {
    // 詳細なエラー情報をログ出力
    console.error('========================================');
    console.error('Node execution error');
    console.error('========================================');
    console.error('Node ID:', node.id);
    console.error('Node type:', node.data.type);
    console.error('Node name:', node.data.config?.name);
    console.error('Error type:', error.constructor?.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error cause:', error.cause);
    console.error('Error stack:', error.stack);
    console.error('Request body:', JSON.stringify(requestBody, null, 2));

    // fetchエラーの場合、causeに詳細情報があることが多い
    if (error.cause) {
      console.error('Error cause details:');
      console.error('  Type:', error.cause.constructor?.name);
      console.error('  Message:', error.cause.message);
      console.error('  Code:', error.cause.code);
      console.error('  Stack:', error.cause.stack);
    }

    // 全てのエラープロパティを出力
    console.error('All error properties:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error('========================================');

    return {
      success: false,
      nodeId: node.id,
      input: inputData,
      requestBody,
      output: null,
      error: error.message,
      errorDetails: error.apiErrorDetails, // APIからの詳細なエラー情報
    };
  }
}

/**
 * 前ノードの出力データを収集
 */
function collectInputData(
  nodeId: string,
  edges: Edge[],
  previousResults: Map<string, ExecutionResult>,
  nodes: Node[]
): any {
  const inputEdges = edges.filter((edge) => edge.target === nodeId);

  if (inputEdges.length === 0) {
    return {};
  }

  const inputs: any = {};
  inputEdges.forEach((edge) => {
    const sourceResult = previousResults.get(edge.source);
    if (sourceResult?.success) {
      // nodeIdでの参照
      inputs[edge.source] = sourceResult.output;

      // ノード名での参照も可能にする
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (sourceNode?.data?.config?.name) {
        inputs[sourceNode.data.config.name] = sourceResult.output;
      }
    }
  });

  return inputs;
}

/**
 * 入力データから画像データを抽出
 */
function extractImagesFromInput(inputData: any): Array<{ mimeType: string; data: string }> {
  const images: Array<{ mimeType: string; data: string }> = [];

  Object.values(inputData).forEach((input: any) => {
    if (input && typeof input === 'object') {
      // imageInputノードからの画像データ
      if (input.imageData && input.imageData.mimeType && input.imageData.data) {
        images.push({
          mimeType: input.imageData.mimeType,
          data: input.imageData.data,
        });
      }
      // nanobananaノードからの生成画像
      else if (input.imageData && typeof input.imageData === 'object') {
        if (input.imageData.mimeType && input.imageData.data) {
          images.push({
            mimeType: input.imageData.mimeType,
            data: input.imageData.data,
          });
        }
      }
    }
  });

  return images;
}

/**
 * プロンプト内の変数を置換
 * サポートする形式:
 * - {{nodeId.property}} - ノードIDで参照
 * - {{nodeName.property}} - ノード名で参照
 * - {{prev.property}} - 直前のノードの出力を参照（単一の入力の場合）
 * - {{prev}} - 直前のノードの出力全体を参照
 */
function replaceVariables(template: string, inputs: any): string {
  // {{...}} 形式の変数を置換
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const parts = path.trim().split('.');
    let value: any;

    // 'prev' ショートカット処理
    if (parts[0] === 'prev') {
      const inputKeys = Object.keys(inputs);
      if (inputKeys.length === 1) {
        // 単一の入力の場合
        value = inputs[inputKeys[0]];
        // prevの後にプロパティ指定がある場合
        if (parts.length > 1) {
          for (let i = 1; i < parts.length; i++) {
            if (value && typeof value === 'object' && parts[i] in value) {
              value = value[parts[i]];
            } else {
              return `{{${path}}}`; // 見つからない場合は元の変数を残す
            }
          }
        }
      } else {
        // 複数の入力がある場合はprevは使えない
        return `{{${path}}}`;
      }
    } else {
      // 通常のパス参照
      value = inputs;
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          return `{{${path}}}`; // 見つからない場合は元の変数を残す
        }
      }
    }

    return value !== undefined && value !== null ? String(value) : `{{${path}}}`;
  });
}

/**
 * ワークフロー全体を実行
 */
export async function executeWorkflow(
  nodes: Node[],
  edges: Edge[],
  onProgress?: (nodeId: string, status: 'running' | 'completed' | 'failed', result?: ExecutionResult) => void
): Promise<WorkflowExecutionResult> {
  try {
    // 実行順序を決定
    const executionOrder = topologicalSort(nodes, edges);

    const results = new Map<string, ExecutionResult>();

    // ノードを順次実行
    for (const nodeId of executionOrder) {
      const node = nodes.find((n) => n.id === nodeId);

      if (!node) {
        throw new Error(`Node not found: ${nodeId}`);
      }

      // 実行中を通知
      onProgress?.(nodeId, 'running');

      // ノードを実行
      const result = await executeNode(node, results, edges, nodes);
      results.set(nodeId, result);

      // 完了/失敗を通知（結果も一緒に渡す）
      onProgress?.(nodeId, result.success ? 'completed' : 'failed', result);

      // エラー時は中断
      if (!result.success) {
        throw new Error(`Node ${nodeId} failed: ${result.error}`);
      }
    }

    return {
      success: true,
      results,
    };
  } catch (error: any) {
    return {
      success: false,
      results: new Map(),
      error: error.message,
    };
  }
}
