import { NextResponse } from 'next/server';
import { createKazikaClient } from '@/lib/kazika-db-client';
import { query } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const sceneId = Number.parseInt(id, 10);
    if (!Number.isFinite(sceneId)) {
      return NextResponse.json({ success: false, error: 'Invalid scene id' }, { status: 400 });
    }

    const sceneResult = await query(
      `
        select
          ssd.*,
          st.title as story_title,
          st.user_id,
          st.description as story_description
        from kazika_studio_agents.story_scenes_domain ssd
        join kazika_studio_agents.stories st on st.id = ssd.story_id
        where ssd.id = $1
          and st.user_id = $2
      `,
      [sceneId, user.id]
    );

    const scene = sceneResult.rows[0];
    if (!scene) {
      return NextResponse.json({ success: false, error: 'Scene not found' }, { status: 404 });
    }

    const [scriptsResult, conversationsResult, shotsResult, assetsResult, tracksResult, clipsResult, jobsResult, layoutsResult, soundEffectsResult] = await Promise.all([
      query(
        `
          select
            sc.*,
            count(sl.id)::integer as line_count
          from kazika_studio_agents.scripts sc
          left join kazika_studio_agents.script_lines sl on sl.script_id = sc.id
            and coalesce(sl.metadata->>'deleted', 'false') <> 'true'
            and coalesce(sl.metadata->>'logical_deleted', 'false') <> 'true'
          where (sc.agent_story_scene_id = $1
             or sc.story_scene_id = $2)
            and coalesce(sc.status, '') <> 'superseded'
          group by sc.id
          order by sc.version desc, sc.id desc
        `,
        [scene.id, scene.source_story_scene_id]
      ),
      query(
        `
          select
            c.*,
            count(cm.id)::integer as message_count
          from kazika_studio_agents.conversations c
          left join kazika_studio_agents.conversation_messages cm on cm.conversation_id = c.id
          where c.story_scene_id = $1
          group by c.id
          order by c.updated_at desc, c.id desc
        `,
        [scene.id]
      ),
      query(
        `
          select
            sh.*,
            count(a.id)::integer as asset_count
          from kazika_studio_agents.shots sh
          left join kazika_studio_agents.assets a on a.shot_id = sh.id
          where sh.agent_story_scene_id = $1
             or sh.story_scene_id = $2
             or sh.script_id in (select id from kazika_studio_agents.scripts where agent_story_scene_id = $1)
          group by sh.id
          order by sh.shot_index asc, sh.id asc
        `,
        [scene.id, scene.source_story_scene_id]
      ),
      query(
        `
          select
            a.*,
            sl.line_index,
            sl.speaker_name,
            sh.shot_index,
            gj.provider,
            gj.model,
            gj.status as generation_status
          from kazika_studio_agents.assets a
          left join kazika_studio_agents.script_lines sl on sl.id = a.script_line_id
          left join kazika_studio_agents.shots sh on sh.id = a.shot_id
          left join kazika_studio_agents.generation_jobs gj on gj.id = a.generation_job_id
          where a.agent_story_scene_id = $1
             or a.story_scene_id = $2
             or a.script_id in (select id from kazika_studio_agents.scripts where agent_story_scene_id = $1)
             or a.shot_id in (select id from kazika_studio_agents.shots where agent_story_scene_id = $1)
          order by a.created_at desc, a.id desc
          limit 200
        `,
        [scene.id, scene.source_story_scene_id]
      ),
      query(
        `
          select
            tt.*,
            count(tc.id)::integer as clip_count
          from kazika_studio_agents.timeline_tracks tt
          left join kazika_studio_agents.timeline_clips tc on tc.track_id = tt.id
            and coalesce(tc.metadata->>'deleted', 'false') <> 'true'
            and coalesce(tc.metadata->>'logical_deleted', 'false') <> 'true'
          where tt.agent_story_scene_id = $1
             or tt.story_scene_id = $2
          group by tt.id
          order by tt.sort_order asc, tt.id asc
        `,
        [scene.id, scene.source_story_scene_id]
      ),
      query(
        `
          select
            tc.*,
            tt.name as track_name,
            tt.track_type,
            tt.sort_order as track_sort_order,
            a.asset_type,
            a.url as asset_url,
            a.storage_path as asset_storage_path,
            a.mime_type as asset_mime_type,
            a.duration_seconds as asset_duration_seconds
          from kazika_studio_agents.timeline_clips tc
          join kazika_studio_agents.timeline_tracks tt on tt.id = tc.track_id
          left join kazika_studio_agents.assets a on a.id = tc.asset_id
          where (tt.agent_story_scene_id = $1
             or tt.story_scene_id = $2)
            and coalesce(tc.metadata->>'deleted', 'false') <> 'true'
            and coalesce(tc.metadata->>'logical_deleted', 'false') <> 'true'
          order by tt.sort_order asc, tc.start_time_ms asc, tc.id asc
        `,
        [scene.id, scene.source_story_scene_id]
      ),
      query(
        `
          select *
          from kazika_studio_agents.generation_jobs
          where agent_story_scene_id = $1
             or story_scene_id = $2
          order by created_at desc, id desc
          limit 100
        `,
        [scene.id, scene.source_story_scene_id]
      ),

      query(
        `
          select
            sl.*,
            a.url as asset_url,
            a.storage_path as asset_storage_path,
            a.mime_type as asset_mime_type,
            a.asset_type as linked_asset_type
          from kazika_studio_agents.scene_layouts sl
          left join kazika_studio_agents.assets a on a.id = sl.asset_id
          where sl.agent_story_scene_id = $1
            and sl.is_active = true
          order by sl.version desc, sl.id desc
          limit 5
        `,
        [scene.id]
      ),
      query(
        `
          select id, name, description, file_name, duration_seconds, category, tags
          from kazikastudio.m_sound_effects
          order by category asc nulls last, name asc, id asc
          limit 500
        `
      ),
    ]);

    const scriptIds = scriptsResult.rows.map((script) => script.id);
    const linesResult = scriptIds.length
      ? await query(
          `
            select
              sl.*,
              ch.name as character_name,
              ch.image_url as character_image_url,
              count(a.id) filter (where a.asset_type = 'audio')::integer as audio_count
            from kazika_studio_agents.script_lines sl
            left join lateral (
              select ch.name, ch.image_url
              from kazika_studio_agents.characters ch
              where ch.id = sl.agent_character_id
                 or ch.source_character_sheet_id = sl.character_sheet_id
              order by
                case when ch.id = sl.agent_character_id then 0 else 1 end,
                ch.id desc
              limit 1
            ) ch on true
            left join kazika_studio_agents.assets a on a.script_line_id = sl.id
            where sl.script_id = any($1::bigint[])
              and coalesce(sl.metadata->>'deleted', 'false') <> 'true'
              and coalesce(sl.metadata->>'logical_deleted', 'false') <> 'true'
            group by sl.id, ch.name, ch.image_url
            order by sl.script_id asc, sl.line_index asc
          `,
          [scriptIds]
        )
      : { rows: [] };

    const timingCuesResult = scriptIds.length
      ? await query(
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
            join kazika_studio_agents.script_lines sl on sl.id = cue.script_line_id
            left join kazikastudio.m_sound_effects se on se.id = cue.sfx_sound_effect_id
            left join kazika_studio_agents.assets a on a.id = cue.sfx_asset_id
            where sl.script_id = any($1::bigint[])
              and coalesce(sl.metadata->>'deleted', 'false') <> 'true'
              and coalesce(sl.metadata->>'logical_deleted', 'false') <> 'true'
            order by cue.script_line_id asc, cue.cue_index asc, cue.id asc
          `,
          [scriptIds]
        )
      : { rows: [] };

    const charactersResult = await query(
      `
        with scene_project as (
          select nullif(coalesce(ssd.metadata->>'project_key', st.metadata->>'project_key'), '') as project_key
          from kazika_studio_agents.story_scenes_domain ssd
          join kazika_studio_agents.stories st on st.id = ssd.story_id
          where ssd.id = $1
        ),
        metadata_character_ids as (
          select (jsonb_array_elements_text(coalesce(ssd.metadata->'speaker_character_ids', '[]'::jsonb)))::bigint as id
          from kazika_studio_agents.story_scenes_domain ssd
          where ssd.id = $1
          union
          select (jsonb_array_elements_text(coalesce(ssd.metadata->'mentioned_character_ids', '[]'::jsonb)))::bigint as id
          from kazika_studio_agents.story_scenes_domain ssd
          where ssd.id = $1
        ),
        line_character_ids as (
          select distinct sl.agent_character_id as id
          from kazika_studio_agents.script_lines sl
          where sl.script_id = any($2::bigint[])
            and sl.agent_character_id is not null
            and coalesce(sl.metadata->>'deleted', 'false') <> 'true'
            and coalesce(sl.metadata->>'logical_deleted', 'false') <> 'true'
        ),
        layout_character_names as (
          select distinct nullif(item->>'name', '') as name
          from kazika_studio_agents.scene_layouts layout
          cross join lateral jsonb_array_elements(coalesce(layout.characters, '[]'::jsonb)) item
          where layout.agent_story_scene_id = $1
            and layout.is_active
        )
        select distinct on (ch.id)
          ch.id,
          ch.name,
          ch.image_url,
          ch.description,
          ch.personality,
          ch.looks,
          ch.video_character_tag,
          ch.is_favorite,
          ch.metadata
        from kazika_studio_agents.characters ch
        where ch.id in (select id from metadata_character_ids union select id from line_character_ids)
           or ch.name in (select name from layout_character_names where name is not null)
           or (
             ch.metadata->>'project_key' = (select project_key from scene_project)
             and (select project_key from scene_project) is not null
           )
        order by ch.id asc
      `,
      [scene.id, scriptIds]
    );

    return NextResponse.json({
      success: true,
      data: {
        scene,
        scripts: scriptsResult.rows,
        scriptLines: linesResult.rows,
        scriptLineTimingCues: timingCuesResult.rows,
        characters: charactersResult.rows,
        conversations: conversationsResult.rows,
        shots: shotsResult.rows,
        assets: assetsResult.rows,
        timelineTracks: tracksResult.rows,
        timelineClips: clipsResult.rows,
        generationJobs: jobsResult.rows,
        sceneLayouts: layoutsResult.rows,
        soundEffects: soundEffectsResult.rows,
      },
    });
  } catch (error: unknown) {
    console.error('Failed to fetch agent scene:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch agent scene';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
