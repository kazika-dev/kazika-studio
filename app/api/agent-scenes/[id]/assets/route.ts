import { NextRequest, NextResponse } from 'next/server';
import { createKazikaClient } from '@/lib/kazika-db-client';
import { query } from '@/lib/db';

const SCENE_IMAGE_TYPES = ['image', 'thumbnail', 'storyboard'];

type AssetDisplayUpdate = {
  id?: unknown;
  scene_image_enabled?: unknown;
  scene_image_order?: unknown;
};

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
    const sceneId = Number.parseInt(id, 10);
    if (!Number.isFinite(sceneId)) {
      return NextResponse.json({ success: false, error: 'Invalid scene id' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const updates = Array.isArray(body.updates) ? body.updates as AssetDisplayUpdate[] : [];
    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'updates is required' }, { status: 400 });
    }

    const sceneResult = await query(
      `
        select ssd.id
        from kazika_studio_agents.story_scenes_domain ssd
        join kazika_studio_agents.stories st on st.id = ssd.story_id
        where ssd.id = $1
          and st.user_id = $2
        limit 1
      `,
      [sceneId, user.id]
    );

    if (!sceneResult.rows[0]) {
      return NextResponse.json({ success: false, error: 'Scene not found' }, { status: 404 });
    }

    const normalizedUpdates = updates.map((item, index) => {
      const assetId = Number.parseInt(String(item.id ?? ''), 10);
      const orderSource = item.scene_image_order ?? index + 1;
      const sceneImageOrder = Number.parseInt(String(orderSource), 10);
      if (!Number.isFinite(assetId) || !Number.isFinite(sceneImageOrder)) {
        throw new Error('Invalid asset display update');
      }
      return {
        id: assetId,
        scene_image_enabled: Boolean(item.scene_image_enabled),
        scene_image_order: Math.max(sceneImageOrder, 1),
      };
    });

    const assetIds = normalizedUpdates.map((item) => item.id);
    const assetsResult = await query(
      `
        select id, asset_type
        from kazika_studio_agents.assets
        where id = any($1::bigint[])
          and agent_story_scene_id = $2
          and asset_type = any($3::text[])
      `,
      [assetIds, sceneId, SCENE_IMAGE_TYPES]
    );

    if (assetsResult.rows.length !== new Set(assetIds).size) {
      return NextResponse.json(
        { success: false, error: 'Some assets were not found or are not scene image assets' },
        { status: 400 }
      );
    }

    const updatedRows = [];
    for (const item of normalizedUpdates) {
      const metadataPatch = {
        scene_image_enabled: item.scene_image_enabled,
        scene_image_order: item.scene_image_order,
        scene_image_display_updated_at: new Date().toISOString(),
        scene_image_display_updated_by: user.id,
      };
      const updated = await query(
        `
          update kazika_studio_agents.assets
          set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
              updated_at = now()
          where id = $1
          returning id, asset_type, metadata
        `,
        [item.id, JSON.stringify(metadataPatch)]
      );
      updatedRows.push(updated.rows[0]);
    }

    return NextResponse.json({ success: true, data: { assets: updatedRows } });
  } catch (error: unknown) {
    console.error('Failed to update scene image display settings:', error);
    const message = error instanceof Error ? error.message : 'Failed to update scene image display settings';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
