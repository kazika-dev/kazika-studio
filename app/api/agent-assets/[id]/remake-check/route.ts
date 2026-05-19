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
    const bodyHasNote = Object.prototype.hasOwnProperty.call(body, 'note');
    const requestedNote = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';

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
    const supportedTypes = ['image', 'thumbnail', 'storyboard', 'audio', 'video', 'talking_video', 'synced_video', 'final_video'];
    if (!supportedTypes.includes(assetType)) {
      return NextResponse.json(
        { success: false, error: 'Remake check is supported only for image/audio/video assets' },
        { status: 400 }
      );
    }

    const isVideo = ['video', 'talking_video', 'synced_video', 'final_video'].includes(assetType);
    const existingMetadata = asset.metadata && typeof asset.metadata === 'object' && !Array.isArray(asset.metadata) ? asset.metadata as Record<string, unknown> : {};
    const existingNote = remakeCheckNoteFromMetadata(existingMetadata);
    const note = bodyHasNote ? requestedNote : existingNote;
    const metadataPatch: Record<string, unknown> = {
      remake_check: checked,
      remake_status: checked ? 'needs_remake' : 'ok',
      remake_check_note: note,
      remake_instruction_note: note,
      remake_check_asset_type: assetType,
      remake_check_target: isVideo ? 'lipsync_video' : assetType,
      remake_check_updated_at: new Date().toISOString(),
      remake_check_updated_by: user.id,
    };

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

function remakeCheckNoteFromMetadata(metadata: Record<string, unknown>) {
  for (const key of ['remake_check_note', 'remake_instruction_note', 'remake_reason']) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 500);
  }
  return '';
}
