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
    const storyId = Number.parseInt(searchParams.get('story_id') || '', 10);

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
    if (Number.isFinite(storyId) && storyId > 0) {
      values.push(storyId);
      filters.push(`st.id = $${values.length}`);
    }

    const whereClause = filters.join('\n          and ');
    const baseValues = [...values];
    const countValues = [...values];

    const sceneValues = [...values, limit, offset];
    const limitParam = sceneValues.length - 1;
    const offsetParam = sceneValues.length;

    const sceneCountsCte = `
        script_rows as (
          select sc.id, ps.id as scene_id
          from paged_scenes ps
          join kazika_studio_agents.scripts sc on sc.agent_story_scene_id = ps.id
        ),
        line_rows as (
          select sl.id, sr.scene_id
          from script_rows sr
          join kazika_studio_agents.script_lines sl on sl.script_id = sr.id
        ),
        shot_rows as (
          select sh.id, ps.id as scene_id
          from paged_scenes ps
          join kazika_studio_agents.shots sh on sh.agent_story_scene_id = ps.id
          union
          select sh.id, sr.scene_id
          from script_rows sr
          join kazika_studio_agents.shots sh on sh.script_id = sr.id
        ),
        asset_scene_links as (
          select ps.id as scene_id, a.id, a.asset_type
          from paged_scenes ps
          join kazika_studio_agents.assets a on a.agent_story_scene_id = ps.id
          union all
          select sr.scene_id, a.id, a.asset_type
          from script_rows sr
          join kazika_studio_agents.assets a on a.script_id = sr.id
          union all
          select shr.scene_id, a.id, a.asset_type
          from shot_rows shr
          join kazika_studio_agents.assets a on a.shot_id = shr.id
          union all
          select lr.scene_id, a.id, a.asset_type
          from line_rows lr
          join kazika_studio_agents.assets a on a.script_line_id = lr.id
        ),
        script_counts as (
          select scene_id, count(distinct id)::integer as script_count
          from script_rows
          group by scene_id
        ),
        line_counts as (
          select scene_id, count(distinct id)::integer as line_count
          from line_rows
          group by scene_id
        ),
        shot_counts as (
          select scene_id, count(distinct id)::integer as shot_count
          from shot_rows
          group by scene_id
        ),
        asset_counts as (
          select
            scene_id,
            count(distinct id)::integer as asset_count,
            count(distinct id) filter (where asset_type = 'audio')::integer as audio_count,
            count(distinct id) filter (where asset_type in ('image', 'thumbnail'))::integer as image_count,
            count(distinct id) filter (where asset_type in ('video', 'talking_video', 'synced_video', 'final_video'))::integer as video_count
          from asset_scene_links
          group by scene_id
        ),
        scene_counts as (
          select
            ps.id,
            coalesce(sc.script_count, 0)::integer as script_count,
            coalesce(lc.line_count, 0)::integer as line_count,
            coalesce(shc.shot_count, 0)::integer as shot_count,
            coalesce(ac.asset_count, 0)::integer as asset_count,
            coalesce(ac.audio_count, 0)::integer as audio_count,
            coalesce(ac.image_count, 0)::integer as image_count,
            coalesce(ac.video_count, 0)::integer as video_count
          from paged_scenes ps
          left join script_counts sc on sc.scene_id = ps.id
          left join line_counts lc on lc.scene_id = ps.id
          left join shot_counts shc on shc.scene_id = ps.id
          left join asset_counts ac on ac.scene_id = ps.id
        )`;

    const storyCountsCte = `
        script_rows as (
          select sc.id, ts.id as scene_id
          from target_scenes ts
          join kazika_studio_agents.scripts sc on sc.agent_story_scene_id = ts.id
        ),
        line_rows as (
          select sl.id, sr.scene_id
          from script_rows sr
          join kazika_studio_agents.script_lines sl on sl.script_id = sr.id
        ),
        shot_rows as (
          select sh.id, ts.id as scene_id
          from target_scenes ts
          join kazika_studio_agents.shots sh on sh.agent_story_scene_id = ts.id
          union
          select sh.id, sr.scene_id
          from script_rows sr
          join kazika_studio_agents.shots sh on sh.script_id = sr.id
        ),
        asset_scene_links as (
          select ts.id as scene_id, a.id, a.asset_type
          from target_scenes ts
          join kazika_studio_agents.assets a on a.agent_story_scene_id = ts.id
          union all
          select sr.scene_id, a.id, a.asset_type
          from script_rows sr
          join kazika_studio_agents.assets a on a.script_id = sr.id
          union all
          select shr.scene_id, a.id, a.asset_type
          from shot_rows shr
          join kazika_studio_agents.assets a on a.shot_id = shr.id
          union all
          select lr.scene_id, a.id, a.asset_type
          from line_rows lr
          join kazika_studio_agents.assets a on a.script_line_id = lr.id
        ),
        script_counts as (
          select scene_id, count(distinct id)::integer as script_count
          from script_rows
          group by scene_id
        ),
        line_counts as (
          select scene_id, count(distinct id)::integer as line_count
          from line_rows
          group by scene_id
        ),
        shot_counts as (
          select scene_id, count(distinct id)::integer as shot_count
          from shot_rows
          group by scene_id
        ),
        asset_counts as (
          select
            scene_id,
            count(distinct id)::integer as asset_count,
            count(distinct id) filter (where asset_type = 'audio')::integer as audio_count,
            count(distinct id) filter (where asset_type in ('image', 'thumbnail'))::integer as image_count,
            count(distinct id) filter (where asset_type in ('video', 'talking_video', 'synced_video', 'final_video'))::integer as video_count
          from asset_scene_links
          group by scene_id
        ),
        scene_counts as (
          select
            ts.id,
            coalesce(sc.script_count, 0)::integer as script_count,
            coalesce(lc.line_count, 0)::integer as line_count,
            coalesce(shc.shot_count, 0)::integer as shot_count,
            coalesce(ac.asset_count, 0)::integer as asset_count,
            coalesce(ac.audio_count, 0)::integer as audio_count,
            coalesce(ac.image_count, 0)::integer as image_count,
            coalesce(ac.video_count, 0)::integer as video_count
          from target_scenes ts
          left join script_counts sc on sc.scene_id = ts.id
          left join line_counts lc on lc.scene_id = ts.id
          left join shot_counts shc on shc.scene_id = ts.id
          left join asset_counts ac on ac.scene_id = ts.id
        )`;

    const [result, storiesResult, countResult] = await Promise.all([
      query(
        `
          with target_scenes as (
            select ssd.id
            from kazika_studio_agents.story_scenes_domain ssd
            join kazika_studio_agents.stories st on st.id = ssd.story_id
            where ${whereClause}
          ),
          paged_scenes as (
            select
              ssd.*,
              st.title as story_title,
              st.user_id,
              st.metadata as story_metadata,
              st.updated_at as story_updated_at,
              coalesce(st.metadata->>'project_key', ssd.metadata->>'project_key') as project_key,
              coalesce(st.metadata->>'genre_mode', ssd.metadata->>'genre_mode') as genre_mode,
              coalesce(ssd.metadata->>'production_status', st.metadata->>'production_status') as production_status,
              coalesce(ssd.metadata->>'episode_no', st.metadata->>'episode_no') as episode_no
            from target_scenes ts
            join kazika_studio_agents.story_scenes_domain ssd on ssd.id = ts.id
            join kazika_studio_agents.stories st on st.id = ssd.story_id
            order by st.updated_at desc nulls last, st.id desc, ssd.sequence_order asc, ssd.id asc
            limit $${limitParam} offset $${offsetParam}
          ),
          ${sceneCountsCte}
          select
            ps.*,
            coalesce(sc.script_count, 0)::integer as script_count,
            coalesce(sc.line_count, 0)::integer as line_count,
            coalesce(sc.shot_count, 0)::integer as shot_count,
            coalesce(sc.asset_count, 0)::integer as asset_count,
            coalesce(sc.audio_count, 0)::integer as audio_count,
            coalesce(sc.image_count, 0)::integer as image_count,
            coalesce(sc.video_count, 0)::integer as video_count
          from paged_scenes ps
          left join scene_counts sc on sc.id = ps.id
          order by ps.story_updated_at desc nulls last, ps.story_id desc, ps.sequence_order asc, ps.id asc
        `,
        sceneValues
      ),
      query(
        `
          with target_scenes as (
            select ssd.id, ssd.story_id, ssd.sequence_order, ssd.metadata
            from kazika_studio_agents.story_scenes_domain ssd
            join kazika_studio_agents.stories st on st.id = ssd.story_id
            where ${whereClause}
          ),
          ${storyCountsCte}
          select
            st.id,
            st.title,
            st.description,
            st.thumbnail_url,
            st.updated_at,
            st.metadata,
            st.default_image_aspect_ratio,
            st.default_video_aspect_ratio,
            coalesce(st.metadata->>'project_key', max(ts.metadata->>'project_key')) as project_key,
            coalesce(st.metadata->>'genre_mode', max(ts.metadata->>'genre_mode')) as genre_mode,
            coalesce(st.metadata->>'production_status', max(ts.metadata->>'production_status')) as production_status,
            count(distinct ts.id)::integer as scene_count,
            (array_agg(ts.id order by ts.sequence_order asc, ts.id asc))[1] as first_scene_id,
            coalesce(sum(sc.script_count), 0)::integer as script_count,
            coalesce(sum(sc.line_count), 0)::integer as line_count,
            coalesce(sum(sc.shot_count), 0)::integer as shot_count,
            coalesce(sum(sc.asset_count), 0)::integer as asset_count,
            coalesce(sum(sc.audio_count), 0)::integer as audio_count,
            coalesce(sum(sc.image_count), 0)::integer as image_count,
            coalesce(sum(sc.video_count), 0)::integer as video_count
          from target_scenes ts
          join kazika_studio_agents.stories st on st.id = ts.story_id
          left join scene_counts sc on sc.id = ts.id
          group by st.id
          order by st.updated_at desc nulls last, st.id desc
        `,
        baseValues
      ),
      query(
        `
          select count(*)::integer as total
          from kazika_studio_agents.story_scenes_domain ssd
          join kazika_studio_agents.stories st on st.id = ssd.story_id
          where ${whereClause}
        `,
        countValues
      ),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        stories: storiesResult.rows,
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
