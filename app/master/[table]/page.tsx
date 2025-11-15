import MasterTableManager from '@/components/master/MasterTableManager';
import { notFound } from 'next/navigation';

interface TableConfig {
  displayName: string;
  description: string;
}

const TABLE_CONFIGS: Record<string, TableConfig> = {
  'm_camera_angles': {
    displayName: 'カメラアングル マスタ',
    description: 'カメラの角度（High Angle, Low Angleなど）を管理します',
  },
  'm_camera_movements': {
    displayName: 'カメラムーブメント マスタ',
    description: 'カメラの動き（Pan, Tilt, Zoomなど）を管理します',
  },
  'm_shot_distances': {
    displayName: 'ショット距離 マスタ',
    description: '撮影距離（Close-up, Medium Shot, Long Shotなど）を管理します',
  },
  'eleven_labs_tags': {
    displayName: 'ElevenLabs タグ マスタ',
    description: 'ElevenLabsの音声タグを管理します',
  },
};

interface PageProps {
  params: Promise<{
    table: string;
  }>;
}

export default async function MasterTablePage({ params }: PageProps) {
  const { table } = await params;

  const config = TABLE_CONFIGS[table];

  if (!config) {
    notFound();
  }

  return (
    <MasterTableManager
      tableName={table}
      displayName={config.displayName}
      description={config.description}
    />
  );
}
