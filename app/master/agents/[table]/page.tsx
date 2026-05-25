'use client';

import { use } from 'react';
import AgentMasterTableManager from '@/components/master/AgentMasterTableManager';

const CONFIGS = {
  characters: { displayName: 'キャラクター', description: 'kazika_studio_agents.characters', fields: { name: 'text', image_url: 'text', description: 'text', personality: 'text', speaking_style: 'text', looks: 'text', video_character_tag: 'text', is_favorite: 'boolean', metadata: 'json' } },
  character_voice_profiles: { displayName: 'ボイス設定', description: 'kazika_studio_agents.character_voice_profiles', fields: { character_id: 'number', name: 'text', provider: 'text', model: 'text', voice_prompt: 'text', voice_seed: 'number', voice_num_steps: 'number', elevenlabs_voice_id: 'text', is_default: 'boolean', metadata: 'json' } },
  stories: { displayName: 'ストーリー', description: 'kazika_studio_agents.stories', fields: { title: 'text', description: 'text', thumbnail_url: 'text', default_image_aspect_ratio: 'text', default_video_aspect_ratio: 'text', metadata: 'json' } },
  story_scenes: { displayName: 'シーン', description: 'kazika_studio_agents.story_scenes_domain', fields: { story_id: 'number', title: 'text', description: 'text', summary: 'text', location: 'text', time_of_day: 'text', mood: 'text', sequence_order: 'number', metadata: 'json' } },
  scene_layouts: { displayName: '配置図', description: 'kazika_studio_agents.scene_layouts', fields: { agent_story_scene_id: 'number', source_story_scene_id: 'number', asset_id: 'number', version: 'number', title: 'text', layout_kind: 'text', description: 'text', spatial_notes: 'text', characters: 'json', anchors: 'json', props: 'json', constraints: 'json', is_active: 'boolean', metadata: 'json' } },
  conversations: { displayName: '会話', description: 'kazika_studio_agents.conversations', fields: { story_scene_id: 'number', title: 'text', description: 'text', location: 'text', draft: 'text', metadata: 'json' } },
  conversation_messages: { displayName: '会話メッセージ', description: 'kazika_studio_agents.conversation_messages', fields: { conversation_id: 'number', character_id: 'number', speaker_name: 'text', message_text: 'text', sequence_order: 'number', timestamp_ms: 'number', scene_prompt_ja: 'text', scene_prompt_en: 'text', metadata: 'json' } },
  text_templates: { displayName: 'テキストテンプレート', description: 'kazika_studio_agents.text_templates', fields: { source_text_template_id: 'number', user_id: 'text', name: 'text', name_ja: 'text', content: 'text', description: 'text', description_ja: 'text', category: 'text', is_active: 'boolean', metadata: 'json' } },
} as const;

type TableKey = keyof typeof CONFIGS;

export default function AgentMasterTablePage({ params }: { params: Promise<{ table: string }> }) {
  const { table } = use(params);
  const config = CONFIGS[table as TableKey];
  if (!config) return <div style={{ padding: '2rem' }}>テーブルが見つかりません: {table}</div>;
  return <AgentMasterTableManager tableKey={table} displayName={config.displayName} description={config.description} fields={config.fields} />;
}
