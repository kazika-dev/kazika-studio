import { Node } from 'reactflow';

/**
 * ノード設定のマイグレーション処理（後方互換性のため）
 * 既存のノードに新しく追加されたフィールドを自動的に追加する
 */
export function migrateNodeConfig(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    const nodeType = node.data.type;
    let config = node.data.config || {};
    let needsUpdate = false;

    // nanobana, gemini, seedream4 ノードに selectedOutputIds フィールドを追加
    if ((nodeType === 'nanobana' || nodeType === 'gemini' || nodeType === 'seedream4') && config.selectedOutputIds === undefined) {
      console.log(`[Migration] Adding selectedOutputIds to ${nodeType} node:`, node.id);
      config = {
        ...config,
        selectedOutputIds: [],
      };
      needsUpdate = true;
    }

    // nanobana ノードに model フィールドを追加
    if (nodeType === 'nanobana' && config.model === undefined) {
      console.log(`[Migration] Adding model to nanobana node:`, node.id);
      config = {
        ...config,
        model: 'gemini-2.5-flash-image',
      };
      needsUpdate = true;
    }

    if (needsUpdate) {
      return {
        ...node,
        data: {
          ...node.data,
          config,
        },
      };
    }

    return node;
  });
}
