import { NextRequest, NextResponse } from 'next/server';
import { createKazikaClient } from '@/lib/kazika-db-client';
import { query } from '@/lib/db';

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
    const hasCompleted = typeof body.completed === 'boolean';
    const hasImageConfirmed = typeof body.image_confirmed === 'boolean';
    const hasAudioConfirmed = typeof body.audio_confirmed === 'boolean';
    if (!hasCompleted && !hasImageConfirmed && !hasAudioConfirmed) {
      return NextResponse.json({ success: false, error: 'completed, image_confirmed, or audio_confirmed must be boolean' }, { status: 400 });
    }

    const lineResult = await query(
      `
        select
          sl.*,
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

    const now = new Date().toISOString();
    const existingMetadata = line.metadata && typeof line.metadata === 'object' ? line.metadata : {};
    const nextMetadata = { ...existingMetadata };

    if (hasCompleted) {
      Object.assign(nextMetadata, {
        script_line_completed: body.completed,
        script_line_completed_at: body.completed ? now : null,
        script_line_completed_by: body.completed ? user.id : null,
        script_line_completed_updated_at: now,
        script_line_completed_updated_by: user.id,
      });
    }

    if (hasImageConfirmed) {
      Object.assign(nextMetadata, {
        script_line_image_confirmed: body.image_confirmed,
        script_line_image_confirmed_at: body.image_confirmed ? now : null,
        script_line_image_confirmed_by: body.image_confirmed ? user.id : null,
        script_line_image_confirmed_updated_at: now,
        script_line_image_confirmed_updated_by: user.id,
      });
    }

    if (hasAudioConfirmed) {
      Object.assign(nextMetadata, {
        script_line_audio_confirmed: body.audio_confirmed,
        script_line_audio_confirmed_at: body.audio_confirmed ? now : null,
        script_line_audio_confirmed_by: body.audio_confirmed ? user.id : null,
        script_line_audio_confirmed_updated_at: now,
        script_line_audio_confirmed_updated_by: user.id,
      });
    }

    const updatedLineResult = await query(
      `
        update kazika_studio_agents.script_lines
        set metadata = $2::jsonb,
            updated_at = now()
        where id = $1
        returning *
      `,
      [scriptLineId, JSON.stringify(nextMetadata)]
    );

    return NextResponse.json({
      success: true,
      data: {
        scriptLine: updatedLineResult.rows[0],
      },
    });
  } catch (error: unknown) {
    console.error('Failed to update script line completion:', error);
    const message = error instanceof Error ? error.message : 'Failed to update script line completion';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
