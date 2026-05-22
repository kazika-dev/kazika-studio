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

export const runtime = 'nodejs';
export const maxDuration = 300;

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

type VideoAssetRow = {
  id: number;
  script_line_id: number;
  storage_path: string | null;
  url: string | null;
  duration_seconds: number | string | null;
  line_index: number | null;
};

type SubtitleRow = {
  id: number;
  script_line_id: number | null;
  source_start_ms: number;
  source_end_ms: number | null;
  metadata: Record<string, unknown>;
};

type SubtitleEvent = {
  id: number;
  startMs: number;
  endMs: number;
  text: string;
};

type ProbeResult = {
  hasAudio: boolean;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
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

function wrapSubtitleTextForAss(value: string, maxCharsPerLine = 18) {
  const normalized = value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[{}]/g, '')
    .trim();
  const lines: string[] = [];

  for (const rawLine of normalized.split('\n')) {
    let current = '';
    for (const char of Array.from(rawLine.trim())) {
      current += char;
      if ('、。！？!?'.includes(char) && current.length >= maxCharsPerLine) {
        lines.push(current);
        current = '';
      }
    }
    if (current) lines.push(current);
  }

  return lines.join('\\N');
}

function subtitleText(clip: SubtitleRow) {
  const raw = clip.metadata?.text ?? '';
  return typeof raw === 'string' ? raw : String(raw ?? '');
}

function clipLocalStartMs(clip: SubtitleRow) {
  const raw = clip.metadata?.local_start_ms ?? clip.source_start_ms ?? 0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function clipLocalEndMs(clip: SubtitleRow, fallbackDurationMs: number) {
  const raw = clip.metadata?.local_end_ms ?? clip.source_end_ms ?? fallbackDurationMs;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallbackDurationMs;
}

function buildAss(events: SubtitleEvent[], width: number, height: number) {
  const marginV = Math.max(24, Math.round(height * 0.12));
  const marginH = Math.max(24, Math.round(width * 0.065));
  const fontSize = Math.max(24, Math.round(height * (58 / 1920)));
  const shadow = Math.max(1, Math.round(height * (2 / 1920)));
  const dialogue = events
    .map((event) => `Dialogue: 0,${assTime(event.startMs)},${assTime(Math.max(event.endMs, event.startMs + 300))},Default,,0,0,0,,${wrapSubtitleTextForAss(event.text)}`)
    .join('\n');

  return `[Script Info]
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: ${width}
PlayResY: ${height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans CJK JP,${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,${shadow},2,${marginH},${marginH},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${dialogue}
`;
}

function ffmpegPathForAss(filePath: string) {
  return filePath.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
}

function concatFileLine(filePath: string) {
  return `file '${filePath.replace(/'/g, `'\\''`)}'`;
}

function runFfmpeg(ffmpegPath: string, args: string[], timeout = 240_000) {
  return new Promise<void>((resolve, reject) => {
    execFile(ffmpegPath, args, { timeout, maxBuffer: 1024 * 1024 * 8 }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`ffmpeg failed: ${stderr || error.message}`));
        return;
      }
      resolve();
    });
  });
}

function probeMedia(ffmpegPath: string, inputPath: string) {
  return new Promise<ProbeResult>((resolve) => {
    execFile(ffmpegPath, ['-hide_banner', '-i', inputPath], { timeout: 20_000, maxBuffer: 1024 * 1024 * 4 }, (_error, _stdout, stderr) => {
      const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      const durationSeconds = durationMatch
        ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
        : null;
      const videoLine = stderr.split('\n').find((line) => /Video:/i.test(line)) || '';
      const sizeMatch = videoLine.match(/(\d{2,5})x(\d{2,5})/);
      const width = sizeMatch ? Number(sizeMatch[1]) : null;
      const height = sizeMatch ? Number(sizeMatch[2]) : null;
      resolve({
        hasAudio: /Stream #\d+:\d+[^\n]*Audio:/i.test(stderr),
        durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
        width: width && Number.isFinite(width) ? width : null,
        height: height && Number.isFinite(height) ? height : null,
      });
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

async function loadSourceVideos(sceneId: number) {
  const result = await query(
    `
      with ranked as (
        select
          a.id,
          a.script_line_id,
          a.storage_path,
          a.url,
          a.duration_seconds,
          sl.line_index,
          row_number() over (
            partition by a.script_line_id
            order by a.is_primary desc, a.created_at desc, a.id desc
          ) as rn
        from kazika_studio_agents.assets a
        join kazika_studio_agents.script_lines sl on sl.id = a.script_line_id
        join kazika_studio_agents.scripts sc on sc.id = sl.script_id
        where a.agent_story_scene_id = $1
          and a.script_line_id is not null
          and (
            a.asset_type in ('video', 'talking_video', 'synced_video')
            or a.mime_type like 'video/%'
          )
          and a.asset_type <> 'final_video'
          and coalesce(a.metadata->>'burned_in_subtitles', 'false') <> 'true'
          and (sc.agent_story_scene_id = $1 or sc.story_scene_id = (select source_story_scene_id from kazika_studio_agents.story_scenes_domain where id = $1))
      )
      select id, script_line_id, storage_path, url, duration_seconds, line_index
      from ranked
      where rn = 1
      order by line_index asc, id asc
    `,
    [sceneId]
  );
  return result.rows as VideoAssetRow[];
}

async function loadSubtitles(sceneId: number, lineIds: number[]) {
  const result = await query(
    `
      select tc.*
      from kazika_studio_agents.timeline_clips tc
      join kazika_studio_agents.timeline_tracks tt on tt.id = tc.track_id
      where tt.agent_story_scene_id = $1
        and tt.track_type = 'text'
        and tc.script_line_id = any($2::bigint[])
      order by tc.script_line_id asc, tc.start_time_ms asc, tc.id asc
    `,
    [sceneId, lineIds]
  );
  return result.rows as SubtitleRow[];
}

export async function POST(
  _request: NextRequest,
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

    const sourceVideos = await loadSourceVideos(sceneId);
    if (sourceVideos.length === 0) {
      return NextResponse.json({ success: false, error: 'No source videos found for this scene.' }, { status: 400 });
    }

    const subtitles = await loadSubtitles(sceneId, sourceVideos.map((asset) => asset.script_line_id));
    if (!subtitles.some((clip) => clip.metadata?.enabled !== false && subtitleText(clip).trim())) {
      return NextResponse.json({ success: false, error: 'No enabled subtitle clips found. Create subtitles first.' }, { status: 400 });
    }

    const ffmpegPath = resolveFfmpegPath();
    workDir = await mkdtemp(path.join(tmpdir(), 'kazika-final-subtitle-render-'));
    const normalizedPaths: string[] = [];
    const normalizedDurationsMs: number[] = [];
    let targetWidth = 1080;
    let targetHeight = 1920;

    for (const [index, asset] of sourceVideos.entries()) {
      const videoPath = normalizeStoragePath(String(asset.storage_path || asset.url || ''));
      if (!videoPath) throw new Error(`Video storage path not found for asset #${asset.id}`);

      const video = await getFileFromStorage(videoPath);
      const inputPath = path.join(workDir, `input-${index}.mp4`);
      const outputPath = path.join(workDir, `normalized-${index}.mp4`);
      await writeFile(inputPath, video.data);

      const probe = await probeMedia(ffmpegPath, inputPath);
      if (index === 0 && probe.width && probe.height) {
        targetWidth = probe.width % 2 === 0 ? probe.width : probe.width - 1;
        targetHeight = probe.height % 2 === 0 ? probe.height : probe.height - 1;
      }
      const assetDurationSeconds = Number(asset.duration_seconds || 0);
      const durationSeconds = assetDurationSeconds > 0 ? assetDurationSeconds : (probe.durationSeconds || 6);
      normalizedDurationsMs.push(Math.round(durationSeconds * 1000));

      const videoFilter = `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p`;
      const args = probe.hasAudio
        ? [
            '-y',
            '-i', inputPath,
            '-map', '0:v:0',
            '-map', '0:a:0',
            '-vf', videoFilter,
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '20',
            '-c:a', 'aac',
            '-ar', '48000',
            '-ac', '2',
            '-shortest',
            '-movflags', '+faststart',
            outputPath,
          ]
        : [
            '-y',
            '-i', inputPath,
            '-f', 'lavfi',
            '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
            '-map', '0:v:0',
            '-map', '1:a:0',
            '-vf', videoFilter,
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '20',
            '-c:a', 'aac',
            '-ar', '48000',
            '-ac', '2',
            '-shortest',
            '-movflags', '+faststart',
            outputPath,
          ];

      await runFfmpeg(ffmpegPath, args);
      normalizedPaths.push(outputPath);
    }

    const concatListPath = path.join(workDir, 'concat.txt');
    const combinedPath = path.join(workDir, 'combined.mp4');
    const assPath = path.join(workDir, 'subtitles.ass');
    const outputPath = path.join(workDir, 'output.mp4');
    await writeFile(concatListPath, normalizedPaths.map(concatFileLine).join('\n'), 'utf8');

    await runFfmpeg(ffmpegPath, [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c', 'copy',
      '-movflags', '+faststart',
      combinedPath,
    ]);

    const subtitleEvents: SubtitleEvent[] = [];
    let offsetMs = 0;
    for (const [index, asset] of sourceVideos.entries()) {
      const durationMs = normalizedDurationsMs[index] || 6000;
      const lineSubtitles = subtitles
        .filter((clip) => clip.script_line_id != null && String(clip.script_line_id) === String(asset.script_line_id))
        .filter((clip) => clip.metadata?.enabled !== false && subtitleText(clip).trim())
        .sort((a, b) => clipLocalStartMs(a) - clipLocalStartMs(b));

      for (const clip of lineSubtitles) {
        const localStart = Math.min(Math.max(clipLocalStartMs(clip), 0), durationMs);
        const localEnd = Math.min(Math.max(clipLocalEndMs(clip, durationMs), localStart + 300), durationMs);
        subtitleEvents.push({
          id: clip.id,
          startMs: offsetMs + localStart,
          endMs: offsetMs + localEnd,
          text: subtitleText(clip).trim(),
        });
      }
      offsetMs += durationMs;
    }

    await writeFile(assPath, buildAss(subtitleEvents, targetWidth, targetHeight), 'utf8');

    await runFfmpeg(ffmpegPath, [
      '-y',
      '-i', combinedPath,
      '-vf', `ass=${ffmpegPathForAss(assPath)}`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '20',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      outputPath,
    ]);

    const outputBuffer = await readFile(outputPath);
    const timestamp = Date.now();
    const filename = `scene-${sceneId}-final-subtitled-${timestamp}.mp4`;
    const storagePath = await uploadImageToStorage(
      outputBuffer.toString('base64'),
      'video/mp4',
      filename,
      `scenes/scene-${sceneId}/final-renders`
    );
    const signedUrl = await getSignedUrl(storagePath, 24 * 60);

    const jobResult = await query(
      `
        insert into kazika_studio_agents.generation_jobs
          (user_id, agent_story_scene_id, job_type, provider, model, status, input, output, metadata, started_at, completed_at)
        values ($1, $2, 'video_render', 'kazika-studio', 'ffmpeg-concat-ass-subtitles', 'completed', $3::jsonb, $4::jsonb, $5::jsonb, now(), now())
        returning *
      `,
      [
        auth.user.id,
        sceneId,
        JSON.stringify({ source_video_asset_ids: sourceVideos.map((asset) => asset.id), subtitle_clip_ids: subtitleEvents.map((event) => event.id) }),
        JSON.stringify({ storage_path: storagePath }),
        JSON.stringify({ renderer: 'ffmpeg', subtitle_format: 'ass', concat: true, burned_in_subtitles: true }),
      ]
    );
    const job = jobResult.rows[0];

    const renderedAssetResult = await query(
      `
        insert into kazika_studio_agents.assets
          (user_id, agent_story_scene_id, generation_job_id, asset_type, url, storage_path, mime_type, duration_seconds, file_size_bytes, is_primary, metadata)
        values ($1, $2, $3, 'final_video', $4, $4, 'video/mp4', $5, $6, false, $7::jsonb)
        returning *
      `,
      [
        auth.user.id,
        sceneId,
        job.id,
        storagePath,
        offsetMs / 1000,
        outputBuffer.length,
        JSON.stringify({
          source_video_asset_ids: sourceVideos.map((asset) => asset.id),
          burned_in_subtitles: true,
          final_concat: true,
          subtitle_clip_ids: subtitleEvents.map((event) => event.id),
          output_size_source: 'first_video',
          output_size: { width: targetWidth, height: targetHeight },
          subtitle_style: { vertical_position: 'bottom_12_percent', background: 'none', punctuation_wrap: true },
        }),
      ]
    );

    return NextResponse.json({
      success: true,
      data: {
        asset: renderedAssetResult.rows[0],
        generationJob: job,
        sourceVideoCount: sourceVideos.length,
        subtitleCount: subtitleEvents.length,
        signedUrl,
        previewUrl: signedUrl,
      },
    });
  } catch (error) {
    console.error('[render-final-subtitled-video] failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to render final subtitled video';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
