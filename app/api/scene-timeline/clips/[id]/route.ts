import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import { deleteSceneTimelineClip, query, updateSceneTimelineClip } from '@/lib/db';

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

async function assertClipOwner(clipId: number, userId: string) {
  const result = await query(
    `SELECT clip.id
     FROM kazikastudio.scene_timeline_clips clip
     JOIN kazikastudio.scene_timeline_tracks track ON track.id = clip.track_id
     WHERE clip.id = $1 AND track.user_id = $2`,
    [clipId, userId]
  );
  return result.rows.length > 0;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const clipId = parseInt(id, 10);
    if (isNaN(clipId)) {
      return NextResponse.json({ error: 'Invalid clip ID' }, { status: 400 });
    }

    if (!(await assertClipOwner(clipId, user.id))) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
    }

    const body = await request.json();
    const clip = await updateSceneTimelineClip(clipId, body);
    return NextResponse.json({ success: true, clip });
  } catch (error: unknown) {
    console.error('Update timeline clip error:', error);
    return NextResponse.json(
      { error: 'Failed to update timeline clip', details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const clipId = parseInt(id, 10);
    if (isNaN(clipId)) {
      return NextResponse.json({ error: 'Invalid clip ID' }, { status: 400 });
    }

    if (!(await assertClipOwner(clipId, user.id))) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
    }

    await deleteSceneTimelineClip(clipId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Delete timeline clip error:', error);
    return NextResponse.json(
      { error: 'Failed to delete timeline clip', details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
