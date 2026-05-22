/* eslint-disable @typescript-eslint/no-explicit-any */
import { query } from '@/lib/db';

type DbRow = Record<string, any>;

function cleanDialogueText(value: unknown) {
  return String(value || '').replace(/^\s*\[[^\]]+\]\s*/, '').trim();
}

function lineIndexForMessage(message: DbRow) {
  const sequence = Number(message.sequence_order ?? 0);
  return sequence <= 0 ? sequence + 1 : sequence;
}

async function getAgentSceneForConversation(conversation: DbRow) {
  const storySceneId = Number(conversation.story_scene_id);
  if (!Number.isFinite(storySceneId)) return null;

  const result = await query(
    `
      select *
      from kazika_studio_agents.story_scenes_domain
      where id = $1
         or source_story_scene_id = $1
      order by case when id = $1 then 0 else 1 end, id desc
      limit 1
    `,
    [storySceneId]
  );

  return result.rows[0] || null;
}

async function getOrCreateScript(scene: DbRow, conversation: DbRow) {
  const existing = await query(
    `
      select *
      from kazika_studio_agents.scripts
      where agent_story_scene_id = $1
         or story_scene_id = $2
         or conversation_id = $3
         or agent_conversation_id = $3
      order by version desc, id desc
      limit 1
    `,
    [scene.id, scene.source_story_scene_id || scene.id, conversation.id]
  );

  if (existing.rows[0]) return existing.rows[0];

  const storySceneId = scene.source_story_scene_id || scene.id;
  const versionResult = await query(
    `select coalesce(max(version), 0) + 1 as next_version from kazika_studio_agents.scripts where story_scene_id = $1`,
    [storySceneId]
  );
  const nextVersion = Number(versionResult.rows[0]?.next_version || 1);

  const created = await query(
    `
      insert into kazika_studio_agents.scripts
        (story_scene_id, conversation_id, version, status, title, body_text, metadata, agent_story_scene_id, agent_conversation_id)
      values ($1, $2, $3, 'draft', $4, '', $5::jsonb, $6, $2)
      returning *
    `,
    [
      storySceneId,
      conversation.id,
      nextVersion,
      conversation.title || scene.title || `Scene ${scene.id}`,
      JSON.stringify({ source: 'conversation_message_sync', conversation_id: Number(conversation.id) }),
      scene.id,
    ]
  );

  return created.rows[0];
}

async function getOrCreateSubtitleTrack(scene: DbRow, script: DbRow) {
  const existing = await query(
    `
      select *
      from kazika_studio_agents.timeline_tracks
      where track_type = 'text'
        and (agent_story_scene_id = $1 or script_id = $2 or story_scene_id = $3)
      order by id desc
      limit 1
    `,
    [scene.id, script.id, scene.source_story_scene_id || scene.id]
  );

  if (existing.rows[0]) return existing.rows[0];

  const created = await query(
    `
      insert into kazika_studio_agents.timeline_tracks
        (agent_story_scene_id, story_scene_id, script_id, name, track_type, sort_order, metadata)
      values ($1, $2, $3, 'Editable Subtitles', 'text', 20, $4::jsonb)
      returning *
    `,
    [
      scene.id,
      scene.source_story_scene_id || scene.id,
      script.id,
      JSON.stringify({ purpose: 'editable_subtitles', editable: true, burned_in: false, source: 'conversation_message_sync' }),
    ]
  );

  return created.rows[0];
}

async function getTimingForLine(sceneId: number, scriptLineId: number, fallbackLineIndex: number) {
  const timing = await query(
    `
      select distinct on (tc.script_line_id)
        tc.start_time_ms,
        tc.end_time_ms,
        tc.source_start_ms,
        tc.source_end_ms
      from kazika_studio_agents.timeline_clips tc
      join kazika_studio_agents.timeline_tracks tt on tt.id = tc.track_id
      where tt.agent_story_scene_id = $1
        and tc.script_line_id = $2
        and tt.track_type in ('audio', 'video')
      order by tc.script_line_id,
        case when tt.track_type = 'audio' then 0 else 1 end,
        tc.id asc
    `,
    [sceneId, scriptLineId]
  );

  const row = timing.rows[0];
  if (row) return row;

  const start = Math.max(0, (fallbackLineIndex - 1) * 3000);
  return {
    start_time_ms: start,
    end_time_ms: start + 3000,
    source_start_ms: 0,
    source_end_ms: 3000,
  };
}

async function updateScriptBody(scriptId: number) {
  const bodyResult = await query(
    `
      select string_agg(
        case
          when nullif(speaker_name, '') is null then text
          else speaker_name || ': ' || text
        end,
        E'\n' order by line_index asc, id asc
      ) as body_text
      from kazika_studio_agents.script_lines
      where script_id = $1
    `,
    [scriptId]
  );

  await query(
    `update kazika_studio_agents.scripts set body_text = $2, updated_at = now() where id = $1`,
    [scriptId, bodyResult.rows[0]?.body_text || '']
  );
}

async function syncSubtitleClip(scene: DbRow, script: DbRow, scriptLine: DbRow) {
  const track = await getOrCreateSubtitleTrack(scene, script);
  const existing = await query(
    `
      select *
      from kazika_studio_agents.timeline_clips
      where track_id = $1 and script_line_id = $2
      order by id desc
      limit 1
    `,
    [track.id, scriptLine.id]
  );

  const timing = await getTimingForLine(Number(scene.id), Number(scriptLine.id), Number(scriptLine.line_index || 1));
  const start = Number(timing.start_time_ms ?? 0);
  const end = Number(timing.end_time_ms ?? start + 3000);
  const sourceEnd = Math.max(1, Number(timing.source_end_ms ?? end - start));
  const previousMetadata = existing.rows[0]?.metadata || {};
  const metadata = {
    ...previousMetadata,
    kind: 'subtitle',
    text: cleanDialogueText(scriptLine.text),
    speaker_name: scriptLine.speaker_name || null,
    enabled: previousMetadata.enabled ?? true,
    editable: true,
    style: previousMetadata.style || {
      position: 'bottom',
      fontSize: 28,
      color: '#ffffff',
      stroke: '#000000',
      background: 'rgba(0,0,0,0.45)',
    },
    local_start_ms: 0,
    local_end_ms: sourceEnd,
    synced_from_conversation_message_id: Number(scriptLine.agent_conversation_message_id || scriptLine.source_conversation_message_id || 0) || null,
  };

  if (existing.rows[0]) {
    const updated = await query(
      `
        update kazika_studio_agents.timeline_clips
        set start_time_ms = $1,
            end_time_ms = $2,
            source_start_ms = 0,
            source_end_ms = $3,
            metadata = $4::jsonb,
            updated_at = now()
        where id = $5
        returning *
      `,
      [start, end, sourceEnd, JSON.stringify(metadata), existing.rows[0].id]
    );
    return updated.rows[0];
  }

  const inserted = await query(
    `
      insert into kazika_studio_agents.timeline_clips
        (track_id, script_line_id, start_time_ms, end_time_ms, source_start_ms, source_end_ms, metadata)
      values ($1, $2, $3, $4, 0, $5, $6::jsonb)
      returning *
    `,
    [track.id, scriptLine.id, start, end, sourceEnd, JSON.stringify(metadata)]
  );
  return inserted.rows[0];
}

async function upsertScriptLineForMessage(script: DbRow, message: DbRow) {
  const targetLineIndex = lineIndexForMessage(message);
  const text = cleanDialogueText(message.message_text);
  if (!text) return null;

  const existing = await query(
    `
      select *
      from kazika_studio_agents.script_lines
      where script_id = $1
        and (agent_conversation_message_id = $2 or source_conversation_message_id = $2)
      order by id desc
      limit 1
    `,
    [script.id, message.id]
  );

  const metadata = {
    ...(existing.rows[0]?.metadata || {}),
    synced_from_conversation: true,
    synced_at: new Date().toISOString(),
  };

  if (!existing.rows[0]) {
    const affected = await query(
      `
        select id, line_index
        from kazika_studio_agents.script_lines
        where script_id = $1 and line_index >= $2
        order by line_index desc, id desc
      `,
      [script.id, targetLineIndex]
    );

    for (const row of affected.rows) {
      await query(
        `update kazika_studio_agents.script_lines set line_index = $2, updated_at = now() where id = $1`,
        [row.id, Number(row.line_index) + 1]
      );
    }
  }

  if (existing.rows[0]) {
    const updated = await query(
      `
        update kazika_studio_agents.script_lines
        set line_index = $2,
            line_type = 'dialogue',
            character_sheet_id = $3,
            agent_character_id = $3,
            speaker_name = $4,
            text = $5,
            tts_text = $5,
            emotion = $6,
            metadata = $7::jsonb,
            updated_at = now()
        where id = $1
        returning *
      `,
      [
        existing.rows[0].id,
        targetLineIndex,
        message.character_id || null,
        message.speaker_name || null,
        text,
        message.metadata?.emotionTag || message.metadata?.emotion || null,
        JSON.stringify(metadata),
      ]
    );
    return updated.rows[0];
  }

  const inserted = await query(
    `
      insert into kazika_studio_agents.script_lines
        (script_id, source_conversation_message_id, agent_conversation_message_id, line_index, line_type, character_sheet_id, agent_character_id, speaker_name, text, tts_text, emotion, metadata)
      values ($1, $2, $2, $3, 'dialogue', $4, $4, $5, $6, $6, $7, $8::jsonb)
      returning *
    `,
    [
      script.id,
      message.id,
      targetLineIndex,
      message.character_id || null,
      message.speaker_name || null,
      text,
      message.metadata?.emotionTag || message.metadata?.emotion || null,
      JSON.stringify(metadata),
    ]
  );

  return inserted.rows[0];
}

export async function syncConversationMessageSceneArtifacts(messageId: number | string) {
  const messageResult = await query(
    `
      select
        cm.*,
        c.id as conversation_id,
        c.story_scene_id,
        c.title as conversation_title,
        c.source_conversation_id,
        c.metadata as conversation_metadata
      from kazika_studio_agents.conversation_messages cm
      join kazika_studio_agents.conversations c on c.id = cm.conversation_id
      where cm.id = $1
      limit 1
    `,
    [messageId]
  );

  const message = messageResult.rows[0];
  if (!message) return { skipped: true, reason: 'message_not_found' };

  const conversation = {
    id: message.conversation_id,
    story_scene_id: message.story_scene_id,
    title: message.conversation_title,
    source_conversation_id: message.source_conversation_id,
    metadata: message.conversation_metadata,
  };

  const scene = await getAgentSceneForConversation(conversation);
  if (!scene) return { skipped: true, reason: 'scene_not_found' };

  const script = await getOrCreateScript(scene, conversation);
  const scriptLine = await upsertScriptLineForMessage(script, message);
  if (!scriptLine) return { skipped: true, reason: 'empty_text' };

  const subtitleClip = await syncSubtitleClip(scene, script, scriptLine);
  await updateScriptBody(Number(script.id));

  return {
    skipped: false,
    sceneId: scene.id,
    scriptId: script.id,
    scriptLineId: scriptLine.id,
    subtitleClipId: subtitleClip.id,
  };
}
