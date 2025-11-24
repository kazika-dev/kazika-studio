/**
 * トポロジカルソート（Kahnアルゴリズム）
 * ワークフローのノードを依存関係に基づいて実行順序にソートする
 */

interface Node {
  id: string;
  [key: string]: any;
}

interface Edge {
  source: string;
  target: string;
  [key: string]: any;
}

export function topologicalSort(nodes: Node[], edges: Edge[]): string[] {
  // 入次数（inDegree）を計算
  const inDegree: Map<string, number> = new Map();
  const adjList: Map<string, string[]> = new Map();

  // 初期化
  nodes.forEach((node) => {
    inDegree.set(node.id, 0);
    adjList.set(node.id, []);
  });

  // エッジから入次数と隣接リストを構築
  edges.forEach((edge) => {
    const { source, target } = edge;
    if (inDegree.has(target)) {
      inDegree.set(target, (inDegree.get(target) || 0) + 1);
    }
    if (adjList.has(source)) {
      adjList.get(source)!.push(target);
    }
  });

  // 入次数が0のノードをキューに追加
  const queue: string[] = [];
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });

  const sorted: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    // 隣接ノードの入次数を減らす
    const neighbors = adjList.get(current) || [];
    neighbors.forEach((neighbor) => {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);

      if (newDegree === 0) {
        queue.push(neighbor);
      }
    });
  }

  // 循環参照をチェック
  if (sorted.length !== nodes.length) {
    console.warn('Cyclic dependency detected in workflow');
    // フォールバック: 元の順序を返す
    return nodes.map((n) => n.id);
  }

  return sorted;
}
