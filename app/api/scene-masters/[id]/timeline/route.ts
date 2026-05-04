import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import {
  createSceneRender,
  createSceneTimelineClip,
  createSceneTimelineTrack,
  ensureDefaultSceneTimelineTracks,
  getSceneAssetsBySceneIds,
  getSceneMasterById,
  getSceneTimeline,
  query,
  SceneTimelineClipType,
  SceneTimelineTrackType,
} from '@/lib/db';

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

async function requireSceneAccess(sceneId: number, userId: string, write = false) {
  const scene = await getSceneMasterById(sceneId);
  if (!scene) {
    return { error: NextResponse.json({ error: 'Scene not found' }, { status: 404 }) };
  }

  if (write && scene.user_id && scene.user_id !== userId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  if (!write && scene.user_id && scene.user_id !== userId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { scene };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const sceneId = parseInt(id, 10);
    if (isNaN(sceneId)) {
      return NextResponse.json({ error: 'Invalid scene ID' }, { status: 400 });
    }

    const access = await requireSceneAccess(sceneId, user.id);
    if (access.error) return access.error;

    const url = new URL(request.url);
    if (url.searchParams.get('ensure_defaults') === 'true') {
      await ensureDefaultSceneTimelineTracks(sceneId, user.id);
    }

    const [timeline, assets] = await Promise.all([
      getSceneTimeline(sceneId, user.id),
      getSceneAssetsBySceneIds([sceneId]),
    ]);

    return NextResponse.json({
      success: true,
      scene: access.scene,
      assets: assets.map((asset) => ({
        ...asset,
        signed_url: `/api/storage/${asset.content_url}`,
      })),
      timeline,
    });
  } catch (error: unknown) {
    console.error('Get scene timeline error:', error);
    return NextResponse.json(
      { error: 'Failed to get scene timeline', details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const sceneId = parseInt(id, 10);
    if (isNaN(sceneId)) {
      return NextResponse.json({ error: 'Invalid scene ID' }, { status: 400 });
    }

    const access = await requireSceneAccess(sceneId, user.id, true);
    if (access.error) return access.error;

    const body = await request.json();
    const action = body.action as string | undefined;

    if (action === 'ensure_defaults') {
      const tracks = await ensureDefaultSceneTimelineTracks(sceneId, user.id);
      return NextResponse.json({ success: true, tracks });
    }

    if (action === 'track') {
      if (!body.track_type) {
        return NextResponse.json({ error: 'track_type is required' }, { status: 400 });
      }

      const track = await createSceneTimelineTrack({
        scene_id: sceneId,
        user_id: user.id,
        track_type: body.track_type as SceneTimelineTrackType,
        name: body.name,
        sort_order: body.sort_order,
        muted: body.muted,
        locked: body.locked,
        visible: body.visible,
        metadata: body.metadata,
      });

      return NextResponse.json({ success: true, track });
    }

    if (action === 'clip') {
      if (!body.track_id || !body.clip_type) {
        return NextResponse.json({ error: 'track_id and clip_type are required' }, { status: 400 });
      }

      const trackCheck = await query(
        'SELECT id FROM kazikastudio.scene_timeline_tracks WHERE id = $1 AND scene_id = $2 AND user_id = $3',
        [body.track_id, sceneId, user.id]
      );
      if (trackCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Track not found' }, { status: 404 });
      }

      const clip = await createSceneTimelineClip({
        scene_id: sceneId,
        track_id: body.track_id,
        scene_asset_id: body.scene_asset_id,
        output_id: body.output_id,
        clip_type: body.clip_type as SceneTimelineClipType,
        title: body.title,
        start_time: body.start_time,
        duration: body.duration,
        source_start_time: body.source_start_time,
        source_end_time: body.source_end_time,
        volume: body.volume,
        opacity: body.opacity,
        z_index: body.z_index,
        playback_rate: body.playback_rate,
        transition_in: body.transition_in,
        transition_out: body.transition_out,
        transform: body.transform,
        metadata: body.metadata,
      });

      return NextResponse.json({ success: true, clip });
    }

    if (action === 'render') {
      const render = await createSceneRender({
        scene_id: sceneId,
        user_id: user.id,
        output_id: body.output_id,
        status: body.status,
        render_settings: body.render_settings,
        error_message: body.error_message,
      });

      return NextResponse.json({ success: true, render });
    }

    return NextResponse.json(
      { error: 'Unknown action. Use ensure_defaults, track, clip, or render.' },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('Create scene timeline item error:', error);
    return NextResponse.json(
      { error: 'Failed to create scene timeline item', details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
