import { NextRequest, NextResponse } from 'next/server';
import { createKazikaClient } from '@/lib/kazika-db-client';
import { query } from '@/lib/db';

const ALLOWED_ASPECT_RATIOS = new Set(['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9']);

type AspectDefaultsBody = {
  default_image_aspect_ratio?: unknown;
  default_video_aspect_ratio?: unknown;
};

function parseAspectRatio(value: unknown, fieldName: string) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !ALLOWED_ASPECT_RATIOS.has(value)) {
    throw new Error(`${fieldName} must be one of ${Array.from(ALLOWED_ASPECT_RATIOS).join(', ')}`);
  }
  return value;
}

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
    const storyId = Number.parseInt(id, 10);
    if (!Number.isFinite(storyId) || storyId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid story id' }, { status: 400 });
    }

    const body = (await request.json()) as AspectDefaultsBody;
    let imageAspectRatio: string | null | undefined;
    let videoAspectRatio: string | null | undefined;

    try {
      imageAspectRatio = parseAspectRatio(body.default_image_aspect_ratio, 'default_image_aspect_ratio');
      videoAspectRatio = parseAspectRatio(body.default_video_aspect_ratio, 'default_video_aspect_ratio');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid aspect ratio';
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    if (imageAspectRatio === undefined && videoAspectRatio === undefined) {
      return NextResponse.json({ success: false, error: 'No aspect ratio fields provided' }, { status: 400 });
    }

    const assignments: string[] = [];
    const values: Array<string | number> = [];

    if (imageAspectRatio !== undefined) {
      values.push(imageAspectRatio ?? '2:3');
      assignments.push(`default_image_aspect_ratio = $${values.length}`);
    }
    if (videoAspectRatio !== undefined) {
      values.push(videoAspectRatio ?? '2:3');
      assignments.push(`default_video_aspect_ratio = $${values.length}`);
    }

    values.push(storyId, user.id);
    const storyIdParam = values.length - 1;
    const userIdParam = values.length;

    const updated = await query(
      `
        update kazika_studio_agents.stories
        set ${assignments.join(', ')},
            updated_at = now()
        where id = $${storyIdParam} and user_id = $${userIdParam}
        returning *
      `,
      values
    );

    if (!updated.rows[0]) {
      return NextResponse.json({ success: false, error: 'Story not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { story: updated.rows[0] } });
  } catch (error: unknown) {
    console.error('Failed to update agent story aspect defaults:', error);
    const message = error instanceof Error ? error.message : 'Failed to update aspect defaults';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
