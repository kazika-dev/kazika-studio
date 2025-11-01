import { Node, Edge } from 'reactflow';

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

        console.log('Gemini execution:', {
          nodeId: node.id,
          nodeName: node.data.config?.name,
          originalPrompt: node.data.config?.prompt,
          promptLength: (node.data.config?.prompt || '').length,
          inputData,
          inputDataKeys: Object.keys(inputData),
          replacedPrompt: geminiPrompt,
          replacedPromptLength: geminiPrompt.length,
        });

        if (!node.data.config?.prompt || !node.data.config.prompt.trim()) {
          throw new Error(`Geminiノード "${node.data.config?.name || node.id}" のプロンプトが設定されていません。ノードの設定を開いてプロンプトを入力し、保存してください。`);
        }

        if (!geminiPrompt.trim()) {
          throw new Error(`Geminiノード "${node.data.config?.name || node.id}" のプロンプト変数が置換できませんでした。元のプロンプト: "${node.data.config?.prompt}"`);
        }

        // リクエストボディを保存
        requestBody = {
          prompt: geminiPrompt,
          model: node.data.config?.model || 'gemini-2.5-flash',
        };

        const geminiResponse = await fetch('/api/gemini', {
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

        console.log('Nanobana execution:', {
          nodeId: node.id,
          nodeName: node.data.config?.name,
          originalPrompt: node.data.config?.prompt,
          promptLength: (node.data.config?.prompt || '').length,
          inputData,
          inputDataKeys: Object.keys(inputData),
          inputTexts,
          finalPrompt: nanobanaPrompt,
          finalPromptLength: nanobanaPrompt.length,
        });

        if (!nanobanaPrompt.trim()) {
          throw new Error(`Nanobanaノード "${node.data.config?.name || node.id}" のプロンプトが空です。プロンプトを入力するか、前のノードから値を受け取ってください。`);
        }

        // リクエストボディを保存
        requestBody = {
          prompt: nanobanaPrompt,
          aspectRatio: node.data.config?.aspectRatio || '1:1',
        };

        const nanobanaResponse = await fetch('/api/nanobana', {
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
          storageUrl: nanobanaData.storageUrl, // GCP StorageのURL
          nodeId: node.id,
        };
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
