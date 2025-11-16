'use client';

import { Node } from 'reactflow';
import UnifiedNodeSettings from './UnifiedNodeSettings';

interface ElevenLabsNodeSettingsProps {
  node: Node;
  onClose: () => void;
  onUpdate: (nodeId: string, config: any) => void;
  onDelete: () => void;
}

export default function ElevenLabsNodeSettings({ node, onClose, onUpdate, onDelete }: ElevenLabsNodeSettingsProps) {
  return (
    <UnifiedNodeSettings
      node={node}
      onClose={onClose}
      onUpdate={onUpdate}
      onDelete={onDelete}
    />
  );
}
