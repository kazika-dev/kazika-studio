import { NextRequest, NextResponse } from 'next/server';
import { createKazikaClient } from '@/lib/kazika-db-client';
import { query } from '@/lib/db';

type SubtitleUpdate = {
  clip_id: number;
  text?: string;
  enabled?: boolean;
};

async function requireScene(sceneId: number) {
  const db = await createKazikaClient();
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }

  const sceneResult = await query(
    `
      select ssd.*, st.user_id
      from kazika_studio_agents.story_scenes_domain ssd
      join kazika_studio_agents.stories st on st.id = ssd.story_id
      where ssd.id = $1 and st.user_id = $2
    `,
    [sceneId, user.id]
  );

  const scene = sceneResult.rows[0];
  if (!scene) {
    return { error: NextResponse.json({ success: false, error: 'Scene not found' }, { status: 404 }) };
  }

  return { user, scene };
}

async function fetchSubtitlePayload(sceneId: number) {
  const [tracksResult, clipsResult] = await Promise.all([
    query(
      `
        select tt.*, count(tc.id)::integer as clip_count
        from kazika_studio_agents.timeline_tracks tt
        left join kazika_studio_agents.timeline_clips tc on tc.track_id = tt.id
        where tt.agent_story_scene_id = $1
        group by tt.id
        order by tt.sort_order asc, tt.id asc
      `,
      [sceneId]
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
        where tt.agent_story_scene_id = $1
        order by tt.sort_order asc, tc.start_time_ms asc, tc.id asc
      `,
      [sceneId]
    ),
  ]);

  return {
    timelineTracks: tracksResult.rows,
    timelineClips: clipsResult.rows,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sceneId = Number.parseInt(id, 10);
    if (!Number.isFinite(sceneId)) {
      return NextResponse.json({ success: false, error: 'Invalid scene id' }, { status: 400 });
    }

    const auth = await requireScene(sceneId);
    if ('error' in auth) return auth.error;

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'sync-script-lines');
    if (action !== 'sync-script-lines') {
      return NextResponse.json({ success: false, error: 'Unsupported action' }, { status: 400 });
    }

    const scriptResult = await query(
      `select id from kazika_studio_agents.scripts where agent_story_scene_id = $1 order by version desc, id desc limit 1`,
      [sceneId]
    );
    const scriptId = scriptResult.rows[0]?.id;
    if (!scriptId) {
      return NextResponse.json({ success: false, error: 'Script not found' }, { status: 404 });
    }

    const existingTrack = await query(
      `select * from kazika_studio_agents.timeline_tracks where agent_story_scene_id = $1 and track_type = 'text' order by id desc limit 1`,
      [sceneId]
    );
    const trackResult = existingTrack.rows[0]
      ? existingTrack
      : await query(
        `
          insert into kazika_studio_agents.timeline_tracks (agent_story_scene_id, script_id, name, track_type, sort_order, metadata)
          values ($1, $2, 'Editable Subtitles', 'text', 20, $3::jsonb)
          returning *
        `,
        [sceneId, scriptId, JSON.stringify({ purpose: 'editable_subtitles', editable: true, burned_in: false })]
      );
    const track = trackResult.rows[0];

    const linesResult = await query(
      `
        select sl.id, sl.line_index, sl.speaker_name, sl.text, sl.tts_text
        from kazika_studio_agents.script_lines sl
        where sl.script_id = $1
        order by sl.line_index asc, sl.id asc
      `,
      [scriptId]
    );

    const timingsResult = await query(
      `
        select distinct on (tc.script_line_id)
          tc.script_line_id,
          tc.start_time_ms,
          tc.end_time_ms,
          tc.source_start_ms,
          tc.source_end_ms,
          tc.metadata
        from kazika_studio_agents.timeline_clips tc
        join kazika_studio_agents.timeline_tracks tt on tt.id = tc.track_id
        where tt.agent_story_scene_id = $1
          and tc.script_line_id is not null
          and tt.track_type in ('audio', 'video')
        order by tc.script_line_id,
          case when tt.track_type = 'audio' then 0 else 1 end,
          tc.id asc
      `,
      [sceneId]
    );
    const timingByLine = new Map(timingsResult.rows.map((row) => [String(row.script_line_id), row]));

    const upserted = [];
    for (const line of linesResult.rows) {
      const timing = timingByLine.get(String(line.id));
      const start = Number(timing?.start_time_ms ?? 0);
      const end = Number(timing?.end_time_ms ?? start + 3000);
      const text = String(line.text || line.tts_text || '').trim();
      if (!text) continue;

      const existing = await query(
        `select * from kazika_studio_agents.timeline_clips where track_id = $1 and script_line_id = $2 order by id desc limit 1`,
        [track.id, line.id]
      );

      const metadata = {
        ...(existing.rows[0]?.metadata || {}),
        kind: 'subtitle',
        text,
        speaker_name: line.speaker_name || null,
        enabled: existing.rows[0]?.metadata?.enabled ?? true,
        editable: true,
        style: existing.rows[0]?.metadata?.style || {
          position: 'bottom',
          fontSize: 28,
          color: '#ffffff',
          stroke: '#000000',
          background: 'rgba(0,0,0,0.45)',
        },
        local_start_ms: 0,
        local_end_ms: Math.max(1, Number(timing?.source_end_ms ?? end - start)),
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
          [start, end, metadata.local_end_ms, JSON.stringify(metadata), existing.rows[0].id]
        );
        upserted.push(updated.rows[0]);
      } else {
        const inserted = await query(
          `
            insert into kazika_studio_agents.timeline_clips
              (track_id, script_line_id, start_time_ms, end_time_ms, source_start_ms, source_end_ms, metadata)
            values ($1, $2, $3, $4, 0, $5, $6::jsonb)
            returning *
          `,
          [track.id, line.id, start, end, metadata.local_end_ms, JSON.stringify(metadata)]
        );
        upserted.push(inserted.rows[0]);
      }
    }

    const payload = await fetchSubtitlePayload(sceneId);
    return NextResponse.json({ success: true, data: { ...payload, upserted } });
  } catch (error: unknown) {
    console.error('[agent-scenes/subtitles] POST failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to sync subtitles';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sceneId = Number.parseInt(id, 10);
    if (!Number.isFinite(sceneId)) {
      return NextResponse.json({ success: false, error: 'Invalid scene id' }, { status: 400 });
    }

    const auth = await requireScene(sceneId);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const updates = Array.isArray(body.updates) ? body.updates as SubtitleUpdate[] : [];
    if (!updates.length) {
      return NextResponse.json({ success: false, error: 'updates is required' }, { status: 400 });
    }

    const updated = [];
    for (const item of updates) {
      const clipId = Number(item.clip_id);
      if (!Number.isFinite(clipId)) continue;
      const clipResult = await query(
        `
          select tc.*
          from kazika_studio_agents.timeline_clips tc
          join kazika_studio_agents.timeline_tracks tt on tt.id = tc.track_id
          where tc.id = $1 and tt.agent_story_scene_id = $2 and tt.track_type = 'text'
        `,
        [clipId, sceneId]
      );
      const clip = clipResult.rows[0];
      if (!clip) continue;
      const metadata = { ...(clip.metadata || {}) };
      if (typeof item.text === 'string') metadata.text = item.text;
      if (typeof item.enabled === 'boolean') metadata.enabled = item.enabled;
      const result = await query(
        `update kazika_studio_agents.timeline_clips set metadata = $1::jsonb, updated_at = now() where id = $2 returning *`,
        [JSON.stringify(metadata), clipId]
      );
      updated.push(result.rows[0]);
    }

    const payload = await fetchSubtitlePayload(sceneId);
    return NextResponse.json({ success: true, data: { ...payload, updated } });
  } catch (error: unknown) {
    console.error('[agent-scenes/subtitles] PATCH failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to update subtitles';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
