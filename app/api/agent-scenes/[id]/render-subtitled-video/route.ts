import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { createRequire } from 'module';
import { createKazikaClient } from '@/lib/kazika-db-client';
import { getFileFromStorage, getSignedUrl, uploadImageToStorage } from '@/lib/gcp-storage';
import { query } from '@/lib/db';
import { syncKazikaAgentIdSequence } from '@/lib/db-sequences';

export const runtime = 'nodejs';
export const maxDuration = 60;

const require = createRequire(import.meta.url);
const ffmpegStaticPath = require('ffmpeg-static') as string | null;

function resolveFfmpegPath() {
  const candidates = [
    process.env.FFMPEG_PATH,
    process.env.FFMPEG_BIN,
    ffmpegStaticPath,
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
    'ffmpeg',
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (candidate === 'ffmpeg' || existsSync(candidate)) return candidate;
  }

  return candidates[candidates.length - 1] || 'ffmpeg';
}

type SubtitleRow = {
  id: number;
  script_line_id: number | null;
  start_time_ms: number;
  end_time_ms: number;
  source_start_ms: number;
  source_end_ms: number | null;
  metadata: Record<string, unknown>;
};

function normalizeStoragePath(input: string) {
  let raw = input.trim();
  if (!raw) return '';
  const bucketName = process.env.GCP_STORAGE_BUCKET;
  try {
    const url = new URL(raw);
    if (bucketName && url.hostname === 'storage.googleapis.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === bucketName) raw = parts.slice(1).join('/');
    } else {
      raw = url.pathname;
    }
  } catch {
    // keep raw
  }
  return decodeURIComponent(raw).replace(/^\/+/, '').replace(/^api\/storage\//, '');
}

function assTime(ms: number) {
  const totalCs = Math.max(0, Math.round(ms / 10));
  const cs = totalCs % 100;
  const totalSeconds = Math.floor(totalCs / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function wrapSubtitleTextForAss(value: string) {
  const normalized = value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[{}]/g, '')
    .trim();
  const lines: string[] = [];

  for (const rawLine of normalized.split('\n')) {
    let current = '';
    const chars = Array.from(rawLine.trim());
    chars.forEach((char, index) => {
      current += char;
      if ('、。！？!?'.includes(char) && index < chars.length - 1) {
        lines.push(current);
        current = '';
      }
    });
    if (current) lines.push(current);
  }

  return lines.join('\\N');
}

function buildAss(subtitles: SubtitleRow[], fallbackDurationMs: number) {
  const events = subtitles
    .filter((clip) => clip.metadata?.enabled !== false)
    .flatMap((clip) => {
      const text = String(clip.metadata?.text || '').trim();
      if (!text) return [];
      const start = Number(clip.metadata?.local_start_ms ?? clip.source_start_ms ?? 0);
      const end = Number(clip.metadata?.local_end_ms ?? clip.source_end_ms ?? fallbackDurationMs);
      const wrappedText = wrapSubtitleTextForAss(text);
      const startTime = assTime(start);
      const endTime = assTime(Math.max(end, start + 300));
      return [
        `Dialogue: 0,${startTime},${endTime},SubtitleShadow,,0,0,0,,{\blur6\bord2}${wrappedText}`,
        `Dialogue: 1,${startTime},${endTime},SubtitleMain,,0,0,0,,${wrappedText}`,
      ];
    })
    .join('\n');

  return `[Script Info]
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: SubtitleShadow,Noto Sans CJK JP,58,&H66000000,&H000000FF,&H66000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,70,70,230,1
Style: SubtitleMain,Noto Sans CJK JP,58,&H00FFFFFF,&H000000FF,&HFF000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,70,70,230,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events}
`;
}

function ffmpegFilterPath(filePath: string) {
  return filePath.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

function subtitleAssFilter(assPath: string) {
  const fontsDir = path.join(process.cwd(), 'public', 'fonts');
  return `ass=${ffmpegFilterPath(assPath)}:fontsdir=${ffmpegFilterPath(fontsDir)}`;
}

function runFfmpeg(ffmpegPath: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    execFile(ffmpegPath, args, { timeout: 55_000 }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`ffmpeg failed: ${stderr || error.message}`));
        return;
      }
      resolve();
    });
  });
}

async function requireScene(sceneId: number) {
  const db = await createKazikaClient();
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }

  const sceneResult = await query(
    `
      select ssd.*, st.user_id
      from kazika_studio_agents.story_scenes_domain ssd
      join kazika_studio_agents.stories st on st.id = ssd.story_id
      where ssd.id = $1 and st.user_id = $2
    `,
    [sceneId, user.id]
  );

  const scene = sceneResult.rows[0];
  if (!scene) return { error: NextResponse.json({ success: false, error: 'Scene not found' }, { status: 404 }) };
  return { user, scene };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let workDir = '';
  try {
    const { id } = await params;
    const sceneId = Number.parseInt(id, 10);
    if (!Number.isFinite(sceneId)) {
      return NextResponse.json({ success: false, error: 'Invalid scene id' }, { status: 400 });
    }
    const auth = await requireScene(sceneId);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const videoAssetId = Number(body.videoAssetId ?? body.asset_id);
    if (!Number.isFinite(videoAssetId)) {
      return NextResponse.json({ success: false, error: 'videoAssetId is required' }, { status: 400 });
    }

    const ffmpegPath = resolveFfmpegPath();
    const assetResult = await query(
      `select * from kazika_studio_agents.assets where id = $1 and agent_story_scene_id = $2`,
      [videoAssetId, sceneId]
    );
    const asset = assetResult.rows[0];
    if (!asset) return NextResponse.json({ success: false, error: 'Video asset not found' }, { status: 404 });

    if (asset.script_line_id != null) {
      const lineResult = await query(
        `select line_type from kazika_studio_agents.script_lines where id = $1 limit 1`,
        [asset.script_line_id]
      );
      const lineType = String(lineResult.rows[0]?.line_type || 'dialogue');
      if (lineType !== 'dialogue') {
        return NextResponse.json({ success: false, error: 'Scene-only/action videos are excluded from subtitle burn-in.' }, { status: 400 });
      }
    }

    const videoPath = normalizeStoragePath(String(asset.storage_path || asset.url || ''));
    if (!videoPath) return NextResponse.json({ success: false, error: 'Video storage path not found' }, { status: 400 });

    const subtitlesResult = await query(
      `
        select tc.*
        from kazika_studio_agents.timeline_clips tc
        join kazika_studio_agents.timeline_tracks tt on tt.id = tc.track_id
        where tt.agent_story_scene_id = $1
          and tt.track_type = 'text'
          and ($2::bigint is null or tc.script_line_id = $2)
        order by tc.start_time_ms asc, tc.id asc
      `,
      [sceneId, asset.script_line_id]
    );
    const subtitles = subtitlesResult.rows as SubtitleRow[];
    if (!subtitles.some((clip) => clip.metadata?.enabled !== false && String(clip.metadata?.text || '').trim())) {
      return NextResponse.json({ success: false, error: 'No enabled subtitle clips found. Create subtitles first.' }, { status: 400 });
    }

    const video = await getFileFromStorage(videoPath);
    workDir = await mkdtemp(path.join(tmpdir(), 'kazika-subtitle-render-'));
    const inputPath = path.join(workDir, 'input.mp4');
    const assPath = path.join(workDir, 'subtitles.ass');
    const outputPath = path.join(workDir, 'output.mp4');
    await writeFile(inputPath, video.data);
    await writeFile(assPath, buildAss(subtitles, Math.round(Number(asset.duration_seconds || 6) * 1000)), 'utf8');

    await runFfmpeg(ffmpegPath, [
      '-y',
      '-i', inputPath,
      '-vf', subtitleAssFilter(assPath),
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '20',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      outputPath,
    ]);

    const outputBuffer = await readFile(outputPath);
    const timestamp = Date.now();
    const filename = `scene-${sceneId}-asset-${videoAssetId}-subtitled-${timestamp}.mp4`;
    const storagePath = await uploadImageToStorage(
      outputBuffer.toString('base64'),
      'video/mp4',
      filename,
      `scenes/scene-${sceneId}/subtitled-renders`
    );
    const signedUrl = await getSignedUrl(storagePath, 24 * 60);

    await syncKazikaAgentIdSequence('generation_jobs');
    const jobResult = await query(
      `
        insert into kazika_studio_agents.generation_jobs
          (user_id, agent_story_scene_id, script_line_id, job_type, provider, model, status, input, output, metadata, started_at, completed_at)
        values ($1, $2, $3, 'video_render', 'kazika-studio', 'ffmpeg-ass-subtitles', 'completed', $4::jsonb, $5::jsonb, $6::jsonb, now(), now())
        returning *
      `,
      [
        auth.user.id,
        sceneId,
        asset.script_line_id,
        JSON.stringify({ source_video_asset_id: videoAssetId, subtitle_clip_ids: subtitles.map((clip) => clip.id) }),
        JSON.stringify({ storage_path: storagePath }),
        JSON.stringify({ renderer: 'ffmpeg', subtitle_format: 'ass', burned_in_subtitles: true }),
      ]
    );
    const job = jobResult.rows[0];

    await syncKazikaAgentIdSequence('assets');
    const renderedAssetResult = await query(
      `
        insert into kazika_studio_agents.assets
          (user_id, agent_story_scene_id, script_line_id, generation_job_id, asset_type, url, storage_path, mime_type, duration_seconds, file_size_bytes, is_primary, metadata)
        values ($1, $2, $3, $4, 'final_video', $5, $5, 'video/mp4', $6, $7, false, $8::jsonb)
        returning *
      `,
      [
        auth.user.id,
        sceneId,
        asset.script_line_id,
        job.id,
        storagePath,
        asset.duration_seconds,
        outputBuffer.length,
        JSON.stringify({
          source_video_asset_id: videoAssetId,
          burned_in_subtitles: true,
          subtitle_clip_ids: subtitles.map((clip) => clip.id),
          editable_source_subtitles_remain_external: true,
        }),
      ]
    );

    return NextResponse.json({
      success: true,
      data: {
        asset: renderedAssetResult.rows[0],
        generationJob: job,
        signedUrl,
        previewUrl: signedUrl,
      },
    });
  } catch (error: unknown) {
    console.error('[render-subtitled-video] failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to render subtitled video';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
