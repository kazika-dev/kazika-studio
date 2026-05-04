import { NextRequest, NextResponse } from 'next/server';
import { createKazikaClient } from '@/lib/kazika-db-client';
import { getStudioById, query } from '@/lib/db';

async function assertStudioOwner(studioId: number) {
  const db = await createKazikaClient();
  const { data: { user }, error: authError } = await db.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const studio = await getStudioById(studioId);
  if (!studio) {
    return { error: NextResponse.json({ error: 'Studio not found' }, { status: 404 }) };
  }

  if (studio.user_id !== user.id) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { user, studio };
}

function parseStudioId(id: string) {
  const studioId = parseInt(id, 10);
  return Number.isFinite(studioId) && studioId > 0 ? studioId : null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * GET /api/studios/[id]/generations
 * スタジオに関連する画像生成・動画生成・ジョブ一覧を返す。
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const studioId = parseStudioId(id);
    if (!studioId) {
      return NextResponse.json({ error: 'Invalid studio ID' }, { status: 400 });
    }

    const auth = await assertStudioOwner(studioId);
    if (auth.error) return auth.error;

    const jobsResult = await query(
      `
      SELECT
        j.*,
        COUNT(DISTINCT ji.id)::int AS input_count,
        COUNT(DISTINCT jr.id)::int AS result_count,
        MAX(result_o.content_url) FILTER (WHERE result_o.content_url IS NOT NULL) AS latest_result_url
      FROM kazikastudio.generation_jobs j
      LEFT JOIN kazikastudio.generation_job_inputs ji ON ji.job_id = j.id
      LEFT JOIN kazikastudio.generation_job_results jr ON jr.job_id = j.id
      LEFT JOIN kazikastudio.workflow_outputs result_o ON result_o.id = jr.output_id
      WHERE j.studio_id = $1 AND j.user_id = $2
      GROUP BY j.id
      ORDER BY j.created_at DESC
      LIMIT 200
      `,
      [studioId, auth.user!.id]
    );

    const imagesResult = await query(
      `
      WITH related_outputs AS (
        SELECT jr.output_id
        FROM kazikastudio.generation_jobs j
        JOIN kazikastudio.generation_job_results jr ON jr.job_id = j.id
        WHERE j.studio_id = $1 AND j.user_id = $2
        UNION
        SELECT ji.output_id
        FROM kazikastudio.generation_jobs j
        JOIN kazikastudio.generation_job_inputs ji ON ji.job_id = j.id
        WHERE j.studio_id = $1 AND j.user_id = $2
        UNION
        SELECT image_output_id AS output_id
        FROM kazikastudio.studio_boards
        WHERE studio_id = $1 AND image_output_id IS NOT NULL
      )
      SELECT
        o.id,
        o.output_type,
        o.content_url,
        o.content_text,
        o.prompt,
        o.metadata,
        o.created_at,
        o.updated_at,
        COUNT(DISTINCT child_jobs.id)::int AS derived_video_jobs,
        COUNT(DISTINCT child_results.output_id)::int AS derived_videos
      FROM kazikastudio.workflow_outputs o
      JOIN related_outputs ro ON ro.output_id = o.id
      LEFT JOIN kazikastudio.generation_job_inputs child_inputs
        ON child_inputs.output_id = o.id
      LEFT JOIN kazikastudio.generation_jobs child_jobs
        ON child_jobs.id = child_inputs.job_id
        AND child_jobs.studio_id = $1
        AND child_jobs.job_type = 'video'
      LEFT JOIN kazikastudio.generation_job_results child_results
        ON child_results.job_id = child_jobs.id
      WHERE o.output_type = 'image'
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 200
      `,
      [studioId, auth.user!.id]
    );

    const videosResult = await query(
      `
      WITH related_outputs AS (
        SELECT jr.output_id
        FROM kazikastudio.generation_jobs j
        JOIN kazikastudio.generation_job_results jr ON jr.job_id = j.id
        WHERE j.studio_id = $1 AND j.user_id = $2
        UNION
        SELECT video_output_id AS output_id
        FROM kazikastudio.studio_boards
        WHERE studio_id = $1 AND video_output_id IS NOT NULL
      )
      SELECT
        o.id,
        o.output_type,
        o.content_url,
        o.content_text,
        o.prompt,
        o.metadata,
        o.created_at,
        o.updated_at,
        source_image.id AS source_image_id,
        source_image.content_url AS source_image_url,
        source_job.id AS generation_job_id,
        source_job.provider,
        source_job.model,
        source_job.status AS job_status
      FROM kazikastudio.workflow_outputs o
      JOIN related_outputs ro ON ro.output_id = o.id
      LEFT JOIN kazikastudio.generation_job_results result_link
        ON result_link.output_id = o.id
      LEFT JOIN kazikastudio.generation_jobs source_job
        ON source_job.id = result_link.job_id
      LEFT JOIN kazikastudio.generation_job_inputs source_input
        ON source_input.job_id = source_job.id
        AND source_input.role IN ('reference', 'start_image', 'image', 'source_image')
      LEFT JOIN kazikastudio.workflow_outputs source_image
        ON source_image.id = source_input.output_id
        AND source_image.output_type = 'image'
      WHERE o.output_type = 'video'
      ORDER BY o.created_at DESC
      LIMIT 200
      `,
      [studioId, auth.user!.id]
    );

    return NextResponse.json({
      success: true,
      studio: auth.studio,
      jobs: jobsResult.rows,
      images: imagesResult.rows,
      videos: videosResult.rows,
    });
  } catch (error: unknown) {
    console.error('Get studio generations error:', error);
    return NextResponse.json(
      { error: 'Failed to get studio generations', details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/studios/[id]/generations
 * チャット/外部生成ツールから生成ジョブを登録するための最小API。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const studioId = parseStudioId(id);
    if (!studioId) {
      return NextResponse.json({ error: 'Invalid studio ID' }, { status: 400 });
    }

    const auth = await assertStudioOwner(studioId);
    if (auth.error) return auth.error;

    const body = await request.json();
    const {
      job_type,
      provider,
      model,
      prompt,
      status = 'draft',
      external_job_id,
      external_job_url,
      credits_used,
      metadata = {},
      inputs = [],
      results = [],
    } = body;

    if (!job_type || !provider) {
      return NextResponse.json(
        { error: 'job_type and provider are required' },
        { status: 400 }
      );
    }

    const jobResult = await query(
      `
      INSERT INTO kazikastudio.generation_jobs
        (user_id, studio_id, job_type, provider, model, prompt, status, external_job_id, external_job_url, credits_used, metadata)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
      RETURNING *
      `,
      [
        auth.user!.id,
        studioId,
        job_type,
        provider,
        model || null,
        prompt || null,
        status,
        external_job_id || null,
        external_job_url || null,
        credits_used || null,
        JSON.stringify(metadata || {}),
      ]
    );

    const job = jobResult.rows[0];

    for (const input of inputs) {
      await query(
        `
        INSERT INTO kazikastudio.generation_job_inputs (job_id, output_id, role, source_url, metadata)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        `,
        [job.id, input.output_id || null, input.role || 'reference', input.source_url || null, JSON.stringify(input.metadata || {})]
      );
    }

    for (const result of results) {
      await query(
        `
        INSERT INTO kazikastudio.generation_job_results (job_id, output_id, rank, selected, metadata)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        `,
        [job.id, result.output_id || null, result.rank || 0, Boolean(result.selected), JSON.stringify(result.metadata || {})]
      );
    }

    return NextResponse.json({ success: true, job }, { status: 201 });
  } catch (error: unknown) {
    console.error('Create generation job error:', error);
    return NextResponse.json(
      { error: 'Failed to create generation job', details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
