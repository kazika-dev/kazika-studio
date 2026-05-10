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
        where st.user_id = $1
        order by st.updated_at desc nulls last, st.id desc, ssd.sequence_order asc, ssd.id asc
        limit $2 offset $3
      `,
      [user.id, limit, offset]
    );

    const countResult = await query(
      `
        select count(*)::integer as total
        from kazika_studio_agents.story_scenes_domain ssd
        join kazika_studio_agents.stories st on st.id = ssd.story_id
        where st.user_id = $1
      `,
      [user.id]
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
