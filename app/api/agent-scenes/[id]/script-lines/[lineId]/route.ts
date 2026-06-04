import { NextRequest, NextResponse } from 'next/server';
import { createKazikaClient } from '@/lib/kazika-db-client';
import { getPool, query } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const db = await createKazikaClient();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, lineId } = await params;
    const sceneId = Number.parseInt(id, 10);
    const scriptLineId = Number.parseInt(lineId, 10);
    if (!Number.isFinite(sceneId) || !Number.isFinite(scriptLineId)) {
      return NextResponse.json({ success: false, error: 'Invalid scene or dialogue id' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const ttsText = typeof body.tts_text === 'string' ? body.tts_text.trim() : text;
    const videoPromptTimingNote = typeof body.video_prompt_timing_note === 'string' ? body.video_prompt_timing_note.trim() : '';
    const videoEventStartSeconds = parseOptionalSeconds(body.video_event_start_seconds);
    const videoEventEndSeconds = parseOptionalSeconds(body.video_event_end_seconds);
    const sfxPrompt = typeof body.sfx_prompt === 'string' ? body.sfx_prompt.trim() : '';
    const sfxStartSeconds = parseOptionalSeconds(body.sfx_start_seconds);
    const sfxDurationSeconds = parseOptionalSeconds(body.sfx_duration_seconds);
    const sfxSoundEffectId = parseOptionalBigInt(body.sfx_sound_effect_id);
    const sfxAssetId = parseOptionalBigInt(body.sfx_asset_id);
    const timingCues = parseTimingCues(body.timing_cues);
    const videoGenerationMode = parseVideoGenerationMode(body.video_generation_mode);
    if (!text) {
      return NextResponse.json({ success: false, error: '会話テキストを入力してください' }, { status: 400 });
    }
    if (text.length > 2000 || ttsText.length > 2000) {
      return NextResponse.json({ success: false, error: '会話テキストが長すぎます' }, { status: 400 });
    }
    if (videoPromptTimingNote.length > 2000 || sfxPrompt.length > 1000) {
      return NextResponse.json({ success: false, error: '動画/SE指定が長すぎます' }, { status: 400 });
    }
    if (videoEventStartSeconds != null && videoEventEndSeconds != null && videoEventEndSeconds < videoEventStartSeconds) {
      return NextResponse.json({ success: false, error: '動画イベントの終了秒は開始秒以降にしてください' }, { status: 400 });
    }

    const lineResult = await query(
      `
        select
          sl.*,
          sc.id as script_id,
          sc.agent_story_scene_id,
          sc.story_scene_id,
          sc.conversation_id,
          sc.agent_conversation_id,
          st.user_id
        from kazika_studio_agents.script_lines sl
        join kazika_studio_agents.scripts sc on sc.id = sl.script_id
        join kazika_studio_agents.story_scenes_domain ssd
          on ssd.id = sc.agent_story_scene_id
          or ssd.source_story_scene_id = sc.story_scene_id
        join kazika_studio_agents.stories st on st.id = ssd.story_id
        where ssd.id = $1
          and sl.id = $2
          and st.user_id = $3
        limit 1
      `,
      [sceneId, scriptLineId, user.id]
    );

    const line = lineResult.rows[0];
    if (!line) {
      return NextResponse.json({ success: false, error: 'Dialogue not found' }, { status: 404 });
    }

    const metadataPatch: Record<string, unknown> = {
      ...(line.metadata && typeof line.metadata === 'object' ? line.metadata : {}),
      edited_in_agent_scene: true,
      edited_at: new Date().toISOString(),
      edited_by: user.id,
    };

    if (videoGenerationMode) {
      const existingVideoSettings = metadataPatch.video_generation_settings && typeof metadataPatch.video_generation_settings === 'object'
        ? (metadataPatch.video_generation_settings as Record<string, unknown>)
        : {};
      metadataPatch.dialogue_video_generation_mode = videoGenerationMode;
      metadataPatch.video_generation_settings = {
        ...existingVideoSettings,
        dialogue_video_mode: videoGenerationMode,
        no_grok_voice: videoGenerationMode === 'silent_back_view_then_mux',
        back_view_only: videoGenerationMode === 'silent_back_view_then_mux',
        hide_mouth: videoGenerationMode === 'silent_back_view_then_mux',
        mux_db_audio_after: true,
      };
    }

    const updatedLineResult = await query(
      `
        update kazika_studio_agents.script_lines
        set text = $2,
            tts_text = $3,
            video_prompt_timing_note = $4,
            video_event_start_seconds = $5,
            video_event_end_seconds = $6,
            sfx_prompt = $7,
            sfx_start_seconds = $8,
            sfx_duration_seconds = $9,
            sfx_sound_effect_id = $10,
            sfx_asset_id = $11,
            metadata = $12::jsonb,
            updated_at = now()
        where id = $1
        returning *
      `,
      [
        scriptLineId,
        text,
        ttsText || text,
        videoPromptTimingNote || null,
        videoEventStartSeconds,
        videoEventEndSeconds,
        sfxPrompt || null,
        sfxStartSeconds,
        sfxDurationSeconds,
        sfxSoundEffectId,
        sfxAssetId,
        JSON.stringify(metadataPatch),
      ]
    );

    let timingCueRows: unknown[] | null = null;
    if (timingCues) {
      await query(
        `delete from kazika_studio_agents.script_line_timing_cues where script_line_id = $1`,
        [scriptLineId]
      );
      if (timingCues.length > 0) {
        const values: unknown[] = [];
        const placeholders = timingCues.map((cue, index) => {
          const base = index * 9;
          values.push(
            scriptLineId,
            index + 1,
            cue.cue_type,
            cue.start_seconds,
            cue.end_seconds,
            cue.prompt,
            cue.sfx_sound_effect_id,
            cue.sfx_asset_id,
            cue.volume
          );
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`;
        }).join(', ');
        await query(
          `
            insert into kazika_studio_agents.script_line_timing_cues
              (script_line_id, cue_index, cue_type, start_seconds, end_seconds, prompt, sfx_sound_effect_id, sfx_asset_id, volume)
            values ${placeholders}
          `,
          values
        );
      }
      const cuesResult = await query(
        `
          select
            cue.*,
            se.name as sfx_sound_effect_name,
            se.file_name as sfx_sound_effect_file_name,
            se.duration_seconds as sfx_sound_effect_duration_seconds,
            a.storage_path as sfx_asset_storage_path,
            a.url as sfx_asset_url,
            a.mime_type as sfx_asset_mime_type,
            a.duration_seconds as sfx_asset_duration_seconds,
            a.metadata as sfx_asset_metadata
          from kazika_studio_agents.script_line_timing_cues cue
          left join kazikastudio.m_sound_effects se on se.id = cue.sfx_sound_effect_id
          left join kazika_studio_agents.assets a on a.id = cue.sfx_asset_id
          where cue.script_line_id = $1
          order by cue.cue_index asc, cue.id asc
        `,
        [scriptLineId]
      );
      timingCueRows = cuesResult.rows;
    }

    const linkedMessageIds = Array.from(new Set([
      line.agent_conversation_message_id,
      line.source_conversation_message_id,
    ].filter(Boolean).map((value) => Number(value))));

    if (linkedMessageIds.length > 0) {
      await query(
        `
          update kazika_studio_agents.conversation_messages
          set message_text = $2,
              metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb
          where id = any($1::bigint[])
        `,
        [linkedMessageIds, text, JSON.stringify({ edited_from_agent_scene: true, edited_at: new Date().toISOString(), edited_by: user.id })]
      );
    }

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
          and coalesce(metadata->>'deleted', 'false') <> 'true'
          and coalesce(metadata->>'logical_deleted', 'false') <> 'true'
      `,
      [line.script_id]
    );

    const updatedScriptResult = await query(
      `
        update kazika_studio_agents.scripts
        set body_text = $2,
            updated_at = now(),
            metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb
        where id = $1
        returning *
      `,
      [line.script_id, bodyResult.rows[0]?.body_text || text, JSON.stringify({ edited_in_agent_scene: true, edited_at: new Date().toISOString(), edited_by: user.id })]
    );

    const conversationIds = Array.from(new Set([
      line.agent_conversation_id,
      line.conversation_id,
    ].filter(Boolean).map((value) => Number(value))));
    if (conversationIds.length > 0) {
      await query(
        `update kazika_studio_agents.conversations set updated_at = now() where id = any($1::bigint[])`,
        [conversationIds]
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        scriptLine: updatedLineResult.rows[0],
        script: updatedScriptResult.rows[0],
        timingCues: timingCueRows,
      },
    });
  } catch (error: unknown) {
    console.error('Failed to update agent scene dialogue:', error);
    const message = error instanceof Error ? error.message : 'Failed to update dialogue';
    const status = message.includes('秒数指定') || message.includes('SE音源ID') || message.includes('キュー') ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}


export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const client = await getPool().connect();
  try {
    const db = await createKazikaClient();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, lineId } = await params;
    const sceneId = Number.parseInt(id, 10);
    const scriptLineId = Number.parseInt(lineId, 10);
    if (!Number.isFinite(sceneId) || !Number.isFinite(scriptLineId)) {
      return NextResponse.json({ success: false, error: 'Invalid scene or dialogue id' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
    const deletedAt = new Date().toISOString();

    await client.query('BEGIN');

    const lineResult = await client.query(
      `
        select
          sl.*,
          sc.id as script_id,
          sc.agent_story_scene_id,
          sc.story_scene_id,
          sc.conversation_id,
          sc.agent_conversation_id,
          st.user_id
        from kazika_studio_agents.script_lines sl
        join kazika_studio_agents.scripts sc on sc.id = sl.script_id
        join kazika_studio_agents.story_scenes_domain ssd
          on ssd.id = sc.agent_story_scene_id
          or ssd.source_story_scene_id = sc.story_scene_id
        join kazika_studio_agents.stories st on st.id = ssd.story_id
        where ssd.id = $1
          and sl.id = $2
          and st.user_id = $3
        limit 1
        for update of sl
      `,
      [sceneId, scriptLineId, user.id]
    );

    const line = lineResult.rows[0];
    if (!line) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Dialogue not found' }, { status: 404 });
    }

    const existingMetadata = line.metadata && typeof line.metadata === 'object' ? line.metadata : {};
    const deletedMetadata = {
      ...existingMetadata,
      deleted: true,
      logical_deleted: true,
      deleted_at: deletedAt,
      deleted_by: user.id,
      delete_reason: reason || 'Deleted from agent scene dialogue editor',
      edited_in_agent_scene: true,
      edited_at: deletedAt,
      edited_by: user.id,
    };

    const deletedLineResult = await client.query(
      `
        update kazika_studio_agents.script_lines
        set metadata = $2::jsonb,
            updated_at = now()
        where id = $1
        returning *
      `,
      [scriptLineId, JSON.stringify(deletedMetadata)]
    );

    await client.query(
      `delete from kazika_studio_agents.script_line_timing_cues where script_line_id = $1`,
      [scriptLineId]
    );

    const linkedMessageIds = Array.from(new Set([
      line.agent_conversation_message_id,
      line.source_conversation_message_id,
    ].filter(Boolean).map((value) => Number(value))));

    if (linkedMessageIds.length > 0) {
      await client.query(
        `
          update kazika_studio_agents.conversation_messages
          set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
          where id = any($1::bigint[])
        `,
        [linkedMessageIds, JSON.stringify({ deleted_from_agent_scene: true, deleted_at: deletedAt, deleted_by: user.id, delete_reason: reason || null })]
      );
    }

    const assetMetadataPatch = {
      stale_due_to_script_line_delete: true,
      stale_script_line_deleted_at: deletedAt,
      stale_script_line_id: String(scriptLineId),
      deleted: true,
      logical_deleted: true,
      deleted_at: deletedAt,
      deleted_by: user.id,
      delete_reason: reason || 'Linked script line was deleted from the agent scene dialogue editor',
    };
    const affectedAssetsResult = await client.query(
      `
        update kazika_studio_agents.assets
        set is_primary = false,
            metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
        where agent_story_scene_id = $1
          and asset_type in ('image', 'thumbnail', 'storyboard', 'audio', 'sfx', 'video')
          and (
            script_line_id = $2
            or (metadata->'covered_script_line_ids') ? $4
            or (metadata->'audio_group_covered_script_line_ids') ? $4
          )
        returning *
      `,
      [sceneId, scriptLineId, JSON.stringify(assetMetadataPatch), String(scriptLineId)]
    );

    const deletedSubtitleClipsResult = await client.query(
      `
        update kazika_studio_agents.timeline_clips tc
        set metadata = coalesce(tc.metadata, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
        from kazika_studio_agents.timeline_tracks tt
        where tt.id = tc.track_id
          and (tt.agent_story_scene_id = $1 or tt.story_scene_id = $1)
          and tc.script_line_id = $2
        returning tc.*
      `,
      [sceneId, scriptLineId, JSON.stringify({ deleted: true, logical_deleted: true, enabled: false, deleted_at: deletedAt, deleted_by: user.id })]
    );

    const bodyResult = await client.query(
      `
        select string_agg(
          case
            when nullif(speaker_name, '') is null then text
            else speaker_name || ': ' || text
          end,
          E'\n' order by line_index asc, id asc
        ) as body_text,
        count(*)::integer as line_count
        from kazika_studio_agents.script_lines
        where script_id = $1
          and coalesce(metadata->>'deleted', 'false') <> 'true'
          and coalesce(metadata->>'logical_deleted', 'false') <> 'true'
      `,
      [line.script_id]
    );

    const updatedScriptResult = await client.query(
      `
        update kazika_studio_agents.scripts
        set body_text = $2,
            updated_at = now(),
            metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb
        where id = $1
        returning *
      `,
      [
        line.script_id,
        bodyResult.rows[0]?.body_text || '',
        JSON.stringify({
          edited_in_agent_scene: true,
          script_line_deleted_at: deletedAt,
          script_line_deleted_by: user.id,
          active_line_count: bodyResult.rows[0]?.line_count || 0,
        }),
      ]
    );

    const conversationIds = Array.from(new Set([
      line.agent_conversation_id,
      line.conversation_id,
    ].filter(Boolean).map((value) => Number(value))));
    if (conversationIds.length > 0) {
      await client.query(
        `update kazika_studio_agents.conversations set updated_at = now() where id = any($1::bigint[])`,
        [conversationIds]
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      data: {
        scriptLine: deletedLineResult.rows[0],
        script: updatedScriptResult.rows[0],
        affectedAssets: affectedAssetsResult.rows,
        deletedSubtitleClips: deletedSubtitleClipsResult.rows,
      },
    });
  } catch (error: unknown) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Failed to delete agent scene dialogue:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete dialogue';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    client.release();
  }
}


type ParsedTimingCue = {
  cue_type: string;
  start_seconds: number | null;
  end_seconds: number | null;
  prompt: string;
  sfx_sound_effect_id: number | null;
  sfx_asset_id: number | null;
  volume: number | null;
};

const VALID_VIDEO_GENERATION_MODES = new Set(['lipsync', 'silent_back_view_then_mux']);

function parseVideoGenerationMode(value: unknown) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !VALID_VIDEO_GENERATION_MODES.has(value)) {
    throw new Error('動画生成モードが不正です');
  }
  return value;
}

const VALID_CUE_TYPES = new Set(['motion', 'camera', 'sfx', 'dialogue', 'transition', 'hold', 'other']);

function parseTimingCues(value: unknown): ParsedTimingCue[] | null {
  if (value === undefined) return null;
  if (!Array.isArray(value)) throw new Error('キュー指定が不正です');
  if (value.length > 50) throw new Error('キューは50件以内にしてください');
  return value.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`キュー${index + 1}が不正です`);
    const record = item as Record<string, unknown>;
    const cueType = typeof record.cue_type === 'string' && VALID_CUE_TYPES.has(record.cue_type) ? record.cue_type : 'motion';
    const startSeconds = parseOptionalSeconds(record.start_seconds);
    const endSeconds = parseOptionalSeconds(record.end_seconds);
    if (startSeconds != null && endSeconds != null && endSeconds < startSeconds) {
      throw new Error(`キュー${index + 1}の終了秒は開始秒以降にしてください`);
    }
    const prompt = typeof record.prompt === 'string' ? record.prompt.trim() : '';
    if (prompt.length > 2000) throw new Error(`キュー${index + 1}のプロンプトが長すぎます`);
    return {
      cue_type: cueType,
      start_seconds: startSeconds,
      end_seconds: endSeconds,
      prompt,
      sfx_sound_effect_id: parseOptionalBigInt(record.sfx_sound_effect_id),
      sfx_asset_id: parseOptionalBigInt(record.sfx_asset_id),
      volume: parseOptionalVolume(record.volume),
    };
  }).filter((cue) => cue.prompt || cue.start_seconds != null || cue.end_seconds != null || cue.sfx_sound_effect_id != null || cue.sfx_asset_id != null || cue.volume != null);
}

function parseOptionalVolume(value: unknown) {
  if (value == null || value === '') return null;
  const numberValue = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(numberValue) || numberValue < 0 || numberValue > 4) {
    throw new Error('SE音量は0〜4の数値で入力してください');
  }
  return Math.round(numberValue * 1000) / 1000;
}

function parseOptionalSeconds(value: unknown) {
  if (value == null || value === '') return null;
  const numberValue = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(numberValue) || numberValue < 0 || numberValue > 3600) {
    throw new Error('秒数指定は0〜3600秒の数値で入力してください');
  }
  return Math.round(numberValue * 1000) / 1000;
}

function parseOptionalBigInt(value: unknown) {
  if (value == null || value === '') return null;
  const numberValue = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isSafeInteger(numberValue) || numberValue <= 0) {
    throw new Error('SE音源IDは正の整数で入力してください');
  }
  return numberValue;
}
