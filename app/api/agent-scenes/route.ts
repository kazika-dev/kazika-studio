import { NextRequest, NextResponse } from 'next/server';
import { createKazikaClient } from '@/lib/kazika-db-client';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const db = await createKazikaClient();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);
    const projectKey = searchParams.get('project_key')?.trim() || '';
    const genreMode = searchParams.get('genre_mode')?.trim() || '';
    const productionStatus = searchParams.get('production_status')?.trim() || '';

    const values: Array<string | number> = [user.id];
    const filters: string[] = ['st.user_id = $1'];

    if (projectKey) {
      values.push(projectKey);
      filters.push(`coalesce(st.metadata->>'project_key', ssd.metadata->>'project_key', '') = $${values.length}`);
    }
    if (genreMode) {
      values.push(genreMode);
      filters.push(`coalesce(st.metadata->>'genre_mode', ssd.metadata->>'genre_mode', '') = $${values.length}`);
    }
    if (productionStatus) {
      values.push(productionStatus);
      filters.push(`coalesce(ssd.metadata->>'production_status', st.metadata->>'production_status', '') = $${values.length}`);
    }

    values.push(limit, offset);
    const limitParam = values.length - 1;
    const offsetParam = values.length;
    const whereClause = filters.join('\n          and ');

    const result = await query(
      `
        with scene_counts as (
          select
            ssd.id,
            count(distinct sc.id) as script_count,
            count(distinct sl.id) as line_count,
            count(distinct sh.id) as shot_count,
            count(distinct a.id) as asset_count,
            count(distinct a.id) filter (where a.asset_type = 'audio') as audio_count,
            count(distinct a.id) filter (where a.asset_type in ('image', 'thumbnail')) as image_count,
            count(distinct a.id) filter (where a.asset_type in ('video', 'talking_video', 'synced_video', 'final_video')) as video_count
          from kazika_studio_agents.story_scenes_domain ssd
          left join kazika_studio_agents.scripts sc on sc.agent_story_scene_id = ssd.id
          left join kazika_studio_agents.script_lines sl on sl.script_id = sc.id
          left join kazika_studio_agents.shots sh on sh.agent_story_scene_id = ssd.id or sh.script_id = sc.id
          left join kazika_studio_agents.assets a on a.agent_story_scene_id = ssd.id or a.script_id = sc.id or a.shot_id = sh.id or a.script_line_id = sl.id
          group by ssd.id
        )
        select
          ssd.*,
          st.title as story_title,
          st.user_id,
          st.metadata as story_metadata,
          coalesce(st.metadata->>'project_key', ssd.metadata->>'project_key') as project_key,
          coalesce(st.metadata->>'genre_mode', ssd.metadata->>'genre_mode') as genre_mode,
          coalesce(ssd.metadata->>'production_status', st.metadata->>'production_status') as production_status,
          coalesce(ssd.metadata->>'episode_no', st.metadata->>'episode_no') as episode_no,
          coalesce(sc.script_count, 0)::integer as script_count,
          coalesce(sc.line_count, 0)::integer as line_count,
          coalesce(sc.shot_count, 0)::integer as shot_count,
          coalesce(sc.asset_count, 0)::integer as asset_count,
          coalesce(sc.audio_count, 0)::integer as audio_count,
          coalesce(sc.image_count, 0)::integer as image_count,
          coalesce(sc.video_count, 0)::integer as video_count
        from kazika_studio_agents.story_scenes_domain ssd
        join kazika_studio_agents.stories st on st.id = ssd.story_id
        left join scene_counts sc on sc.id = ssd.id
        where ${whereClause}
        order by st.updated_at desc nulls last, st.id desc, ssd.sequence_order asc, ssd.id asc
        limit $${limitParam} offset $${offsetParam}
      `,
      values
    );

    const countValues = values.slice(0, -2);
    const countResult = await query(
      `
        select count(*)::integer as total
        from kazika_studio_agents.story_scenes_domain ssd
        join kazika_studio_agents.stories st on st.id = ssd.story_id
        where ${whereClause}
      `,
      countValues
    );

    return NextResponse.json({
      success: true,
      data: {
        scenes: result.rows,
        total: countResult.rows[0]?.total || 0,
      },
    });
  } catch (error: unknown) {
    console.error('Failed to fetch agent scenes:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch agent scenes';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
