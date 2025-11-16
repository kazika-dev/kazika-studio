'use client';

import { Node, Edge } from 'reactflow';
import UnifiedNodeSettings from './UnifiedNodeSettings';

interface HiggsfieldNodeSettingsProps {
  node: Node;
  nodes: Node[];
  edges: Edge[];
  onClose: () => void;
  onUpdate: (nodeId: string, config: any) => void;
  onDelete: () => void;
}

export default function HiggsfieldNodeSettings({ node, nodes, edges, onClose, onUpdate, onDelete }: HiggsfieldNodeSettingsProps) {
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
