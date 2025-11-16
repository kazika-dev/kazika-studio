'use client';

import { Node, Edge } from 'reactflow';
import UnifiedNodeSettings from './UnifiedNodeSettings';

interface Seedream4NodeSettingsProps {
  node: Node;
  nodes: Node[];
  edges: Edge[];
  onClose: () => void;
  onUpdate: (nodeId: string, config: any) => void;
  onDelete: () => void;
}

export default function Seedream4NodeSettings({ node, nodes, edges, onClose, onUpdate, onDelete }: Seedream4NodeSettingsProps) {
  return (
    <UnifiedNodeSettings
      node={node}
      nodes={nodes}
      edges={edges}
      onClose={onClose}
      onUpdate={onUpdate}
      onDelete={onDelete}
    />
  );
}
