import { Node, Edge } from 'reactflow';

export interface ExecutionResult {
  success: boolean;
  nodeId: string;
  input?: any;
  requestBody?: any;
  output: any;
  error?: string;
  errorDetails?: any; // APIから返された詳細なエラー情報
  skipped?: boolean; // ノードがスキップされた場合にtrue（例: 選択されていないキャラクターシート）
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
