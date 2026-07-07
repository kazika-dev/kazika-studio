import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { createKazikaClient } from '@/lib/kazika-db-client';
import { getFileFromStorage, uploadImageToStorage } from '@/lib/gcp-storage';
import { query } from '@/lib/db';

const FLIPPABLE_IMAGE_TYPES = ['image', 'thumbnail', 'storyboard', 'layout_reference', 'placement_diagram', 'background_reference', 'location_reference', 'environment_reference'];

function outputMimeType(format?: string, fallback?: string | null) {
  if (format === 'jpeg' || format === 'jpg') return 'image/jpeg';
  if (format === 'png') return 'image/png';
  if (format === 'webp') return 'image/webp';
  if (format === 'avif') return 'image/avif';
  if (format === 'tiff') return 'image/tiff';
  if (fallback?.startsWith('image/')) return fallback;
  return 'image/png';
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/avif') return 'avif';
  if (mimeType === 'image/tiff') return 'tiff';
  return 'png';
}

function baseNameFromPath(value: string) {
  const clean = String(value || '').split('?')[0].replace(/^\/+/, '').replace(/^api\/storage\//, '');
  const last = clean.split('/').filter(Boolean).pop() || 'asset';
  return last.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 80) || 'asset';
}

async function loadAssetImage(asset: Record<string, unknown>) {
  const storagePath = typeof asset.storage_path === 'string' ? asset.storage_path : '';
  const url = typeof asset.url === 'string' ? asset.url : '';
  const source = storagePath || url;
  if (!source) throw new Error('Asset image path not found');

  try {
    return await getFileFromStorage(source);
  } catch (storageError) {
    if (!url || !/^https?:\/\//.test(url)) throw storageError;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch asset image: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return {
      data: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type') || String(asset.mime_type || 'image/png'),
    };
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
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

    const { id, assetId: assetIdParam } = await params;
    const sceneId = Number.parseInt(id, 10);
    const assetId = Number.parseInt(assetIdParam, 10);
    if (!Number.isFinite(sceneId) || !Number.isFinite(assetId)) {
      return NextResponse.json({ success: false, error: 'Invalid scene or asset id' }, { status: 400 });
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

    const assetResult = await query(
      `
        select *
        from kazika_studio_agents.assets
        where id = $1
          and (agent_story_scene_id = $2 or story_scene_id = $2)
          and asset_type = any($3::text[])
        limit 1
      `,
      [assetId, sceneId, FLIPPABLE_IMAGE_TYPES]
    );
    const asset = assetResult.rows[0];
    if (!asset) {
      return NextResponse.json({ success: false, error: 'Image asset not found in this scene' }, { status: 404 });
    }

    const { data, contentType } = await loadAssetImage(asset);
    const transformed = await sharp(data).flop().toBuffer({ resolveWithObject: true });
    const mimeType = outputMimeType(transformed.info.format, contentType || asset.mime_type);
    const extension = extensionForMimeType(mimeType);
    const sourcePath = String(asset.storage_path || asset.url || `asset-${asset.id}`);
    const fileName = `${baseNameFromPath(sourcePath)}-flipped-${Date.now()}.${extension}`;
    const storagePath = await uploadImageToStorage(transformed.data.toString('base64'), mimeType, fileName, 'images');

    const previous = {
      url: asset.url ?? null,
      storage_path: asset.storage_path ?? null,
      mime_type: asset.mime_type ?? null,
    };
    const metadataPatch = {
      image_flipped_horizontal_at: new Date().toISOString(),
      image_flipped_horizontal_by: user.id,
      image_flip_source_asset_id: asset.id,
      image_flip_previous: previous,
    };

    await query(
      `
        update kazika_studio_agents.assets
        set url = $2,
            storage_path = $2,
            mime_type = $3,
            file_size_bytes = $4,
            metadata = coalesce(metadata, '{}'::jsonb) || $5::jsonb,
            updated_at = now()
        where id = $1
      `,
      [assetId, storagePath, mimeType, transformed.data.byteLength, JSON.stringify(metadataPatch)]
    );

    const refreshed = await query(
      `
        select
          a.*,
          sl.line_index,
          sl.speaker_name,
          sl.line_type as script_line_type,
          sl.metadata as script_line_metadata,
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
      [assetId]
    );

    return NextResponse.json({ success: true, data: { asset: refreshed.rows[0] } });
  } catch (error: unknown) {
    console.error('Failed to flip scene image asset horizontally:', error);
    const message = error instanceof Error ? error.message : 'Failed to flip scene image asset horizontally';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
