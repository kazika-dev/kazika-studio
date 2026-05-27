import { NextRequest, NextResponse } from 'next/server';
import { createKazikaClient } from '@/lib/kazika-db-client';
import { query } from '@/lib/db';

const SCENE_IMAGE_TYPES = ['image', 'thumbnail', 'storyboard'];

type AssetDisplayUpdate = {
  id?: unknown;
  scene_image_enabled?: unknown;
  scene_image_order?: unknown;
};

type AssetLineLinkUpdate = {
  asset_id?: unknown;
  script_line_id?: unknown;
};

type AssetPrimaryUpdate = {
  asset_id?: unknown;
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
    const linkUpdates = Array.isArray(body.linkUpdates) ? body.linkUpdates as AssetLineLinkUpdate[] : [];
    const primaryUpdates = Array.isArray(body.primaryUpdates) ? body.primaryUpdates as AssetPrimaryUpdate[] : [];
    if (updates.length === 0 && linkUpdates.length === 0 && primaryUpdates.length === 0) {
      return NextResponse.json({ success: false, error: 'updates, linkUpdates, or primaryUpdates is required' }, { status: 400 });
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

    const updatedRows = [];

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

    if (normalizedUpdates.length > 0) {
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
    }

    const linkedRows = [];
    for (const item of linkUpdates) {
      const assetId = Number.parseInt(String(item.asset_id ?? ''), 10);
      const rawLineId = item.script_line_id;
      const nextLineId = rawLineId === null || rawLineId === '' || rawLineId === undefined
        ? null
        : Number.parseInt(String(rawLineId), 10);
      if (!Number.isFinite(assetId) || (nextLineId !== null && !Number.isFinite(nextLineId))) {
        return NextResponse.json({ success: false, error: 'Invalid asset link update' }, { status: 400 });
      }

      const assetResult = await query(
        `
          select id, generation_job_id, asset_type
          from kazika_studio_agents.assets
          where id = $1
            and (agent_story_scene_id = $2 or story_scene_id = $2)
            and asset_type in ('image', 'thumbnail', 'storyboard', 'audio', 'sfx', 'video')
          limit 1
        `,
        [assetId, sceneId]
      );
      const asset = assetResult.rows[0];
      if (!asset) {
        return NextResponse.json({ success: false, error: `Asset ${assetId} was not found in this scene` }, { status: 400 });
      }

      let line = null;
      if (nextLineId !== null) {
        const lineResult = await query(
          `
            select
              sl.id,
              sl.script_id,
              sl.line_index,
              sl.speaker_name,
              sl.agent_conversation_message_id,
              sc.agent_conversation_id
            from kazika_studio_agents.script_lines sl
            join kazika_studio_agents.scripts sc on sc.id = sl.script_id
            where sl.id = $1
              and (sc.agent_story_scene_id = $2 or sc.story_scene_id = $2)
            limit 1
          `,
          [nextLineId, sceneId]
        );
        line = lineResult.rows[0];
        if (!line) {
          return NextResponse.json({ success: false, error: `Script line ${nextLineId} was not found in this scene` }, { status: 400 });
        }
      }

      const metadataPatch = {
        linked_script_line_id: nextLineId,
        linked_line_index: line?.line_index ?? null,
        linked_speaker_name: line?.speaker_name ?? null,
        link_updated_at: new Date().toISOString(),
        link_updated_by: user.id,
        link_update_source: 'agent_scene_assets_ui',
      };

      const updatedAsset = await query(
        `
          update kazika_studio_agents.assets
          set script_line_id = $2,
              script_id = $3,
              agent_conversation_id = $4,
              agent_conversation_message_id = $5,
              metadata = coalesce(metadata, '{}'::jsonb) || $6::jsonb,
              updated_at = now()
          where id = $1
          returning *
        `,
        [
          assetId,
          nextLineId,
          line?.script_id ?? null,
          line?.agent_conversation_id ?? null,
          line?.agent_conversation_message_id ?? null,
          JSON.stringify(metadataPatch),
        ]
      );

      if (asset.generation_job_id) {
        await query(
          `
            update kazika_studio_agents.generation_jobs
            set script_line_id = $2,
                script_id = $3,
                agent_conversation_id = $4,
                agent_conversation_message_id = $5,
                metadata = coalesce(metadata, '{}'::jsonb) || $6::jsonb,
                updated_at = now()
            where id = $1
          `,
          [
            asset.generation_job_id,
            nextLineId,
            line?.script_id ?? null,
            line?.agent_conversation_id ?? null,
            line?.agent_conversation_message_id ?? null,
            JSON.stringify(metadataPatch),
          ]
        );
      }

      const refreshed = await query(
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
          where a.id = $1
          limit 1
        `,
        [updatedAsset.rows[0].id]
      );
      linkedRows.push(refreshed.rows[0] || updatedAsset.rows[0]);
    }

    const primaryRows = [];
    for (const item of primaryUpdates) {
      const assetId = Number.parseInt(String(item.asset_id ?? ''), 10);
      if (!Number.isFinite(assetId)) {
        return NextResponse.json({ success: false, error: 'Invalid primary asset update' }, { status: 400 });
      }

      const assetResult = await query(
        `
          select id, asset_type, script_line_id, mime_type
          from kazika_studio_agents.assets
          where id = $1
            and (agent_story_scene_id = $2 or story_scene_id = $2)
            and asset_type in ('image', 'thumbnail', 'storyboard', 'audio', 'video')
          limit 1
        `,
        [assetId, sceneId]
      );
      const asset = assetResult.rows[0];
      if (!asset) {
        return NextResponse.json({ success: false, error: `Asset ${assetId} was not found in this scene` }, { status: 400 });
      }
      if (asset.script_line_id == null) {
        return NextResponse.json({ success: false, error: `Asset ${assetId} is not linked to a dialogue line` }, { status: 400 });
      }

      const assetType = String(asset.asset_type || '');
      const scopeTypes = SCENE_IMAGE_TYPES.includes(assetType) ? SCENE_IMAGE_TYPES : [assetType];
      const metadataPatch = {
        dialogue_primary_updated_at: new Date().toISOString(),
        dialogue_primary_updated_by: user.id,
        dialogue_primary_scope: scopeTypes.join(','),
        dialogue_primary_update_source: 'agent_scene_assets_ui',
      };

      const updated = await query(
        `
          update kazika_studio_agents.assets
          set is_primary = (id = $1),
              metadata = case
                when id = $1 then coalesce(metadata, '{}'::jsonb) || $5::jsonb
                else coalesce(metadata, '{}'::jsonb)
              end,
              updated_at = now()
          where (agent_story_scene_id = $2 or story_scene_id = $2)
            and script_line_id = $3
            and asset_type = any($4::text[])
          returning *
        `,
        [assetId, sceneId, asset.script_line_id, scopeTypes, JSON.stringify(metadataPatch)]
      );

      for (const row of updated.rows) {
        const refreshed = await query(
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
            where a.id = $1
            limit 1
          `,
          [row.id]
        );
        primaryRows.push(refreshed.rows[0] || row);
      }
    }

    return NextResponse.json({ success: true, data: { assets: updatedRows, linkedAssets: linkedRows, primaryAssets: primaryRows } });
  } catch (error: unknown) {
    console.error('Failed to update scene image display settings:', error);
    const message = error instanceof Error ? error.message : 'Failed to update scene image display settings';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
