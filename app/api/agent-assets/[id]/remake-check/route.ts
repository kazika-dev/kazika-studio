import { NextRequest, NextResponse } from 'next/server';
import { createKazikaClient } from '@/lib/kazika-db-client';
import { query } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
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
    const assetId = Number.parseInt(id, 10);
    if (!Number.isFinite(assetId)) {
      return NextResponse.json({ success: false, error: 'Invalid asset id' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const checked = Boolean(body.checked);
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';

    const assetResult = await query(
      `
        select
          a.id,
          a.asset_type,
          a.metadata,
          a.user_id,
          st.user_id as scene_user_id
        from kazika_studio_agents.assets a
        left join kazika_studio_agents.story_scenes_domain ssd on ssd.id = a.agent_story_scene_id
        left join kazika_studio_agents.stories st on st.id = ssd.story_id
        where a.id = $1
          and (a.user_id = $2 or st.user_id = $2)
        limit 1
      `,
      [assetId, user.id]
    );

    const asset = assetResult.rows[0];
    if (!asset) {
      return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
    }

    const assetType = String(asset.asset_type || '');
    if (!['image', 'thumbnail', 'storyboard', 'audio'].includes(assetType)) {
      return NextResponse.json(
        { success: false, error: 'Remake check is supported only for image/audio assets' },
        { status: 400 }
      );
    }

    const metadataPatch: Record<string, unknown> = {
      remake_check: checked,
      remake_status: checked ? 'needs_remake' : 'ok',
      remake_check_updated_at: new Date().toISOString(),
      remake_check_updated_by: user.id,
    };
    if (note) metadataPatch.remake_check_note = note;

    const updatedResult = await query(
      `
        update kazika_studio_agents.assets
        set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
            updated_at = now()
        where id = $1
        returning id, asset_type, metadata
      `,
      [assetId, JSON.stringify(metadataPatch)]
    );

    return NextResponse.json({ success: true, data: { asset: updatedResult.rows[0] } });
  } catch (error: unknown) {
    console.error('Failed to update remake check:', error);
    const message = error instanceof Error ? error.message : 'Failed to update remake check';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
