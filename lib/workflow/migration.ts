import { Node } from 'reactflow';

/**
 * ノード設定のマイグレーション処理（後方互換性のため）
 * 既存のノードに新しく追加されたフィールドを自動的に追加する
 */
export function migrateNodeConfig(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    const nodeType = node.data.type;
    const config = node.data.config || {};

    // nanobana, gemini ノードに selectedOutputIds フィールドを追加
    if ((nodeType === 'nanobana' || nodeType === 'gemini') && config.selectedOutputIds === undefined) {
      console.log(`[Migration] Adding selectedOutputIds to ${nodeType} node:`, node.id);
      return {
        ...node,
        data: {
          ...node.data,
          config: {
            ...config,
            selectedOutputIds: [],
          },
        },
      };
    }

    return node;
  });
}
