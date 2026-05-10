'use client';

import { use } from 'react';
import AgentMasterTableManager from '@/components/master/AgentMasterTableManager';

const CONFIGS = {
  characters: { displayName: 'キャラクター', description: 'kazika_studio_agents.characters', fields: { name: 'text', image_url: 'text', description: 'text', personality: 'text', speaking_style: 'text', looks: 'text', video_character_tag: 'text', is_favorite: 'boolean', metadata: 'json' } },
  character_voice_profiles: { displayName: 'ボイス設定', description: 'kazika_studio_agents.character_voice_profiles', fields: { character_id: 'number', name: 'text', provider: 'text', model: 'text', voice_prompt: 'text', voice_seed: 'number', voice_num_steps: 'number', is_default: 'boolean', metadata: 'json' } },
  stories: { displayName: 'ストーリー', description: 'kazika_studio_agents.stories', fields: { title: 'text', description: 'text', thumbnail_url: 'text', metadata: 'json' } },
  story_scenes: { displayName: 'シーン', description: 'kazika_studio_agents.story_scenes_domain', fields: { story_id: 'number', title: 'text', description: 'text', summary: 'text', location: 'text', time_of_day: 'text', mood: 'text', sequence_order: 'number', metadata: 'json' } },
  conversations: { displayName: '会話', description: 'kazika_studio_agents.conversations', fields: { story_scene_id: 'number', title: 'text', description: 'text', location: 'text', draft: 'text', metadata: 'json' } },
  conversation_messages: { displayName: '会話メッセージ', description: 'kazika_studio_agents.conversation_messages', fields: { conversation_id: 'number', character_id: 'number', speaker_name: 'text', message_text: 'text', sequence_order: 'number', timestamp_ms: 'number', scene_prompt_ja: 'text', scene_prompt_en: 'text', metadata: 'json' } },
} as const;

type TableKey = keyof typeof CONFIGS;

export default function AgentMasterTablePage({ params }: { params: Promise<{ table: string }> }) {
  const { table } = use(params);
  const config = CONFIGS[table as TableKey];
  if (!config) return <div style={{ padding: '2rem' }}>テーブルが見つかりません: {table}</div>;
  return <AgentMasterTableManager tableKey={table} displayName={config.displayName} description={config.description} fields={config.fields} />;
}
