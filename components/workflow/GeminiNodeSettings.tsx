'use client';

import { Node } from 'reactflow';
import UnifiedNodeSettings from './UnifiedNodeSettings';

interface GeminiNodeSettingsProps {
  node: Node;
  onClose: () => void;
  onUpdate: (nodeId: string, config: any) => void;
  onDelete: () => void;
}

export default function GeminiNodeSettings({ node, onClose, onUpdate, onDelete }: GeminiNodeSettingsProps) {
  return (
    <UnifiedNodeSettings
      node={node}
      onClose={onClose}
      onUpdate={onUpdate}
      onDelete={onDelete}
    />
  );
}
