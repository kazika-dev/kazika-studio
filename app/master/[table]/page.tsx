
'use client';

import { use } from 'react';
import MasterTableManager from '@/components/master/MasterTableManager';

interface TableConfig {
  displayName: string;
  description: string;

  showJapaneseFields?: boolean; // 日本語フィールドを持つテーブルかどうか
}

const TABLE_CONFIGS: Record<string, TableConfig> = {
  'eleven_labs_tags': {
    displayName: 'ElevenLabs タグ',
    description: 'ElevenLabs 音声生成用のタグマスタデータを管理します。',
    showJapaneseFields: false, // eleven_labs_tagsには日本語フィールドがない
  },
  'm_camera_angles': {
    displayName: 'カメラアングル',
    description: 'カメラアングルのマスタデータを管理します（ハイアングル、ローアングルなど）。',
    showJapaneseFields: true,
  },
  'm_camera_movements': {
    displayName: 'カメラムーブメント',
    description: 'カメラの動きのマスタデータを管理します（パン、ティルト、ズームなど）。',
    showJapaneseFields: true,
  },
  'm_shot_distances': {
    displayName: 'ショット距離',
    description: 'ショット距離のマスタデータを管理します（クローズアップ、ロングショットなど）。',
    showJapaneseFields: true,
  },
};

export default function MasterTablePage({
  params,
}: {
  params: Promise<{ table: string }>;
}) {
  const { table } = use(params);


  const config = TABLE_CONFIGS[table];

  if (!config) {

    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>テーブルが見つかりません</h1>
        <p>指定されたテーブル「{table}」は存在しません。</p>
      </div>
    );

  }

  return (
    <MasterTableManager
      tableName={table}
      displayName={config.displayName}
      description={config.description}

      showJapaneseFields={config.showJapaneseFields}

    />
  );
}
