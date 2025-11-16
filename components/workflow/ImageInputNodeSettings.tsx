'use client';

import { Node } from 'reactflow';
import UnifiedNodeSettings from './UnifiedNodeSettings';

interface ImageInputNodeSettingsProps {
  node: Node;
  onClose: () => void;
  onUpdate: (nodeId: string, config: any) => void;
  onDelete: () => void;
}

export default function ImageInputNodeSettings({ node, onClose, onUpdate, onDelete }: ImageInputNodeSettingsProps) {
  return (
    <UnifiedNodeSettings
      node={node}
      onClose={onClose}
      onUpdate={onUpdate}
      onDelete={onDelete}
    />
  );
}
