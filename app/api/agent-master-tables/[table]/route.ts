import { NextRequest, NextResponse } from 'next/server';
import { createKazikaClient } from '@/lib/kazika-db-client';
import { query } from '@/lib/db';

type FieldType = 'text' | 'number' | 'boolean' | 'json';
type TableConfig = { table: string; orderBy: string; fields: Record<string, FieldType>; required?: string[] };

const TABLES: Record<string, TableConfig> = {
  characters: { table: 'characters', orderBy: 'updated_at desc, id desc', required: ['name'], fields: { name: 'text', image_url: 'text', description: 'text', personality: 'text', speaking_style: 'text', looks: 'text', video_character_tag: 'text', is_favorite: 'boolean', metadata: 'json' } },
  character_voice_profiles: { table: 'character_voice_profiles', orderBy: 'updated_at desc, id desc', required: ['character_id', 'name'], fields: { character_id: 'number', name: 'text', provider: 'text', model: 'text', voice_prompt: 'text', voice_seed: 'number', voice_num_steps: 'number', elevenlabs_voice_id: 'text', is_default: 'boolean', metadata: 'json' } },
  stories: { table: 'stories', orderBy: 'updated_at desc, id desc', required: ['title'], fields: { title: 'text', description: 'text', thumbnail_url: 'text', metadata: 'json' } },
  story_scenes: { table: 'story_scenes_domain', orderBy: 'sequence_order asc, id asc', required: ['title'], fields: { story_id: 'number', title: 'text', description: 'text', summary: 'text', location: 'text', time_of_day: 'text', mood: 'text', sequence_order: 'number', metadata: 'json' } },
  scene_layouts: { table: 'scene_layouts', orderBy: 'agent_story_scene_id asc, version desc, id desc', required: ['agent_story_scene_id'], fields: { agent_story_scene_id: 'number', source_story_scene_id: 'number', asset_id: 'number', version: 'number', title: 'text', layout_kind: 'text', description: 'text', spatial_notes: 'text', characters: 'json', anchors: 'json', props: 'json', constraints: 'json', is_active: 'boolean', metadata: 'json' } },
  conversations: { table: 'conversations', orderBy: 'updated_at desc, id desc', required: ['title'], fields: { story_scene_id: 'number', title: 'text', description: 'text', location: 'text', draft: 'text', metadata: 'json' } },
  conversation_messages: { table: 'conversation_messages', orderBy: 'conversation_id desc, sequence_order asc, id asc', required: ['conversation_id', 'speaker_name', 'message_text', 'sequence_order'], fields: { conversation_id: 'number', character_id: 'number', speaker_name: 'text', message_text: 'text', sequence_order: 'number', timestamp_ms: 'number', scene_prompt_ja: 'text', scene_prompt_en: 'text', metadata: 'json' } },
  text_templates: { table: 'text_templates', orderBy: 'updated_at desc, id desc', required: ['name', 'content'], fields: { source_text_template_id: 'number', user_id: 'text', name: 'text', name_ja: 'text', content: 'text', description: 'text', description_ja: 'text', category: 'text', is_active: 'boolean', metadata: 'json' } },
};

async function requireUser() {
  const db = await createKazikaClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) return null;
  return user;
}
function configFor(key: string) { return TABLES[key] || null; }
function parseValue(value: unknown, type: FieldType) {
  if (value === '' || value === undefined) return null;
  if (type === 'number') return value === null ? null : Number(value);
  if (type === 'boolean') return Boolean(value);
  if (type === 'json') return value ?? {};
  return typeof value === 'string' ? value : value == null ? null : String(value);
}
function validate(config: TableConfig, body: Record<string, unknown>) {
  for (const field of config.required || []) {
    const value = body[field];
    if (value === undefined || value === null || value === '') return `${field} is required`;
  }
  return null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  try {
    if (!(await requireUser())) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const { table } = await params;
    const config = configFor(table);
    if (!config) return NextResponse.json({ success: false, error: 'Invalid table' }, { status: 400 });
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') || 100), 300);
    const offset = Math.max(Number(searchParams.get('offset') || 0), 0);
    const result = await query(`select * from kazika_studio_agents.${config.table} order by ${config.orderBy} limit $1 offset $2`, [limit, offset]);
    const count = await query(`select count(*)::integer as total from kazika_studio_agents.${config.table}`);
    return NextResponse.json({ success: true, data: { records: result.rows, total: count.rows[0]?.total || 0, fields: config.fields } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch records';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  try {
    if (!(await requireUser())) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const { table } = await params;
    const config = configFor(table);
    if (!config) return NextResponse.json({ success: false, error: 'Invalid table' }, { status: 400 });
    const body = await request.json() as Record<string, unknown>;
    const error = validate(config, body);
    if (error) return NextResponse.json({ success: false, error }, { status: 400 });
    const columns = Object.keys(config.fields).filter((field) => body[field] !== undefined);
    const values = columns.map((field) => parseValue(body[field], config.fields[field]));
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const result = await query(`insert into kazika_studio_agents.${config.table} (${columns.join(', ')}) values (${placeholders.join(', ')}) returning *`, values);
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create record';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  try {
    if (!(await requireUser())) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const { table } = await params;
    const config = configFor(table);
    if (!config) return NextResponse.json({ success: false, error: 'Invalid table' }, { status: 400 });
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    const error = validate(config, body);
    if (error) return NextResponse.json({ success: false, error }, { status: 400 });
    const columns = Object.keys(config.fields).filter((field) => body[field] !== undefined);
    const values = columns.map((field) => parseValue(body[field], config.fields[field]));
    values.push(id);
    const assignments = columns.map((field, index) => `${field} = $${index + 1}`);
    assignments.push('updated_at = now()');
    const result = await query(`update kazika_studio_agents.${config.table} set ${assignments.join(', ')} where id = $${values.length} returning *`, values);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update record';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  try {
    if (!(await requireUser())) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const { table } = await params;
    const config = configFor(table);
    if (!config) return NextResponse.json({ success: false, error: 'Invalid table' }, { status: 400 });
    const id = Number(new URL(request.url).searchParams.get('id'));
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    const result = await query(`delete from kazika_studio_agents.${config.table} where id = $1 returning *`, [id]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete record';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
