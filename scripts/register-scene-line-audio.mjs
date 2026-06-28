#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('/Users/creative/.openclaw/kazika-studio/package.json');
const { Storage } = require('@google-cloud/storage');
const { Client } = require('pg');

function parseArgs(argv) {
  const args = {
    project: 'direct-disk-346206', secretDb: 'NEON_DB', secretGcp: 'GCP_SERVICE_ACCOUNT_KEY', bucket: 'kazika',
    userId: 'fab20022-1030-4e35-b080-757e83a01449', sceneId: '', scriptLineId: '', file: '',
    provider: 'runpod', model: '', prompt: '', inputText: '', extraMetadataJson: '{}', source: 'openclaw_scene29_irodori_tts_generation', productionBaseUrl: 'https://kazika-studio-vrdafz7ndq-an.a.run.app'
  };
  for (let i = 2; i < argv.length; i += 1) {
    const k = argv[i], v = argv[i + 1];
    switch (k) {
      case '--scene-id': args.sceneId = v || ''; i++; break;
      case '--script-line-id': args.scriptLineId = v || ''; i++; break;
      case '--file': args.file = v || ''; i++; break;
      case '--provider': args.provider = v || args.provider; i++; break;
      case '--model': args.model = v || ''; i++; break;
      case '--prompt': args.prompt = v || ''; i++; break;
      case '--input-text': args.inputText = v || ''; i++; break;
      case '--extra-metadata-json': args.extraMetadataJson = v || '{}'; i++; break;
      case '--source': args.source = v || args.source; i++; break;
      case '--user-id': args.userId = v || args.userId; i++; break;
      case '--production-base-url': args.productionBaseUrl = v || args.productionBaseUrl; i++; break;
      case '-h': case '--help': console.log('Usage: register-scene-line-audio.mjs --scene-id 29 --script-line-id 1052 --file out.wav --input-text text'); process.exit(0);
      default: throw new Error(`Unknown argument: ${k}`);
    }
  }
  for (const k of ['sceneId','scriptLineId','file']) if (!args[k]) throw new Error(`${k} required`);
  if (!existsSync(args.file)) throw new Error(`File not found: ${args.file}`);
  return args;
}
function secret(project, name) { return execFileSync('gcloud', ['secrets','versions','access','latest','--project',project,'--secret',name], {encoding:'utf8', stdio:['ignore','pipe','pipe']}).trim(); }
function safe(s) { return String(s||'audio').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80) || 'audio'; }
function mimeFor(file) { const e = extname(file).toLowerCase(); if (e === '.mp3') return 'audio/mpeg'; if (e === '.m4a') return 'audio/mp4'; return 'audio/wav'; }
function readWavInfo(file) {
  const b = readFileSync(file);
  if (b.toString('ascii',0,4) !== 'RIFF' || b.toString('ascii',8,12) !== 'WAVE') return null;
  let off = 12, fmt = null, dataSize = null;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    const start = off + 8;
    if (id === 'fmt ') fmt = { audioFormat: b.readUInt16LE(start), channels: b.readUInt16LE(start+2), sampleRate: b.readUInt32LE(start+4), byteRate: b.readUInt32LE(start+8), blockAlign: b.readUInt16LE(start+12), bitsPerSample: b.readUInt16LE(start+14) };
    else if (id === 'data') dataSize = size;
    off = start + size + (size % 2);
  }
  if (!fmt || !dataSize) return null;
  return { duration_seconds: Math.round((dataSize / fmt.byteRate) * 1000) / 1000, sample_rate_hz: fmt.sampleRate, channels: fmt.channels, bits_per_sample: fmt.bitsPerSample, duration_probe: 'wav_header' };
}
function readAudioInfo(file) {
  const wavInfo = readWavInfo(file);
  if (wavInfo?.duration_seconds != null) return wavInfo;
  try {
    const raw = execFileSync('ffprobe', ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1', file], { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim();
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds > 0) {
      return { duration_seconds: Math.round(seconds * 1000) / 1000, sample_rate_hz: null, channels: null, bits_per_sample: null, duration_probe: 'ffprobe_format' };
    }
  } catch {}
  return { duration_seconds: null, sample_rate_hz: null, channels: null, bits_per_sample: null, duration_probe: 'unavailable' };
}
function shouldSwitchToLongAudioLipSync(line, audioInfo) {
  const duration = Number(audioInfo.duration_seconds);
  if (!Number.isFinite(duration) || duration < 6.0) return false;
  if (line.video_generation_provider === 'none') return false;
  const metadata = line.metadata && typeof line.metadata === 'object' ? line.metadata : {};
  if (metadata.final_render_mode === 'still_image_3s') return false;
  if (line.line_type === 'dialogue') return true;
  if (metadata.tts_mode === 'lipsync' || metadata.lipsync === true || metadata.lip_sync === true || metadata.mouth_lipsync_enabled === true) return true;
  return false;
}

const args = parseArgs(process.argv);
const sceneId = Number(args.sceneId), scriptLineId = Number(args.scriptLineId);
const fileSize = statSync(args.file).size;
const audioInfo = readAudioInfo(args.file);
const neon = secret(args.project, args.secretDb);
const credentials = JSON.parse(secret(args.project, args.secretGcp));
let bucketName = args.bucket;
try { bucketName = secret(args.project, 'GCP_STORAGE_BUCKET') || bucketName; } catch {}
try { bucketName = secret(args.project, 'GCP_STRAGE_BUCKET') || bucketName; } catch {}
const storage = new Storage({ credentials, projectId: credentials.project_id });
const client = new Client({ connectionString: neon });
await client.connect();
try {
  const lineRes = await client.query(
    `SELECT sl.id, sl.script_id, sl.line_index, sl.line_type, sl.speaker_name, sl.text, sl.tts_text, sl.agent_character_id, sl.agent_conversation_message_id,
            sl.video_generation_provider, sl.metadata,
            sc.agent_conversation_id, c.name AS character_name, cvp.id AS voice_profile_id, cvp.model AS voice_model, cvp.voice_prompt, cvp.voice_seed, cvp.voice_num_steps,
            cvp.irodori_reference_audio_enabled, cvp.irodori_reference_audio_local_path, cvp.irodori_reference_audio_source_asset_id, cvp.irodori_reference_audio_source_script_line_id
       FROM kazika_studio_agents.script_lines sl
       JOIN kazika_studio_agents.scripts sc ON sc.id = sl.script_id
       LEFT JOIN kazika_studio_agents.characters c ON c.id = sl.agent_character_id
       LEFT JOIN kazika_studio_agents.character_voice_profiles cvp ON cvp.character_id = sl.agent_character_id
      WHERE sl.id=$1 AND (sc.agent_story_scene_id=$2 OR sc.story_scene_id=$2)
      ORDER BY coalesce(cvp.is_default,false) DESC, cvp.id
      LIMIT 1`, [scriptLineId, sceneId]);
  const line = lineRes.rows[0];
  if (!line) throw new Error(`script line ${scriptLineId} not found in scene ${sceneId}`);
  const mime = mimeFor(args.file);
  const objectPath = `audio/agent-scenes/${sceneId}/script-${line.script_id}/irodori/line-${String(line.line_index).padStart(3,'0')}-${scriptLineId}-${safe(line.speaker_name || line.character_name)}-${Date.now()}-${basename(args.file)}`;
  await storage.bucket(bucketName).file(objectPath).save(readFileSync(args.file), { metadata: { contentType: mime, cacheControl: 'private, max-age=3600' } });
  const now = new Date().toISOString();
  const extra = JSON.parse(args.extraMetadataJson || '{}');
  const inputText = args.inputText || line.tts_text || line.text || '';
  const meta = {
    source: args.source,
    provider: args.provider,
    model: args.model || line.voice_model || 'Aratako/Irodori-TTS-500M-v2',
    checkpoint: args.model || line.voice_model || 'Aratako/Irodori-TTS-500M-v2',
    agent_story_scene_id: sceneId,
    script_id: line.script_id,
    script_line_id: scriptLineId,
    linked_script_line_id: scriptLineId,
    linked_line_index: line.line_index,
    scene_audio_order: line.line_index,
    line_type: line.line_type,
    speaker_name: line.speaker_name,
    character_name: line.character_name,
    agent_character_id: line.agent_character_id,
    character_id: line.agent_character_id,
    voice_profile_id: line.voice_profile_id,
    text: inputText,
    tts_text: inputText,
    actual_input_text: inputText,
    voice_prompt: line.voice_prompt,
    voice_seed: line.voice_seed,
    base_voice_seed: line.voice_seed,
    voice_num_steps: line.voice_num_steps,
    no_split_sentences: true,
    tts_chunks: null,
    irodori_reference_audio_enabled: line.irodori_reference_audio_enabled,
    irodori_reference_audio_local_path: line.irodori_reference_audio_local_path,
    irodori_reference_audio_source_asset_id: line.irodori_reference_audio_source_asset_id,
    irodori_reference_audio_source_script_line_id: line.irodori_reference_audio_source_script_line_id,
    duration_seconds: audioInfo.duration_seconds,
    sample_rate_hz: audioInfo.sample_rate_hz,
    channels: audioInfo.channels,
    bits_per_sample: audioInfo.bits_per_sample,
    duration_probe: audioInfo.duration_probe,
    file_size_bytes: fileSize,
    storage_path: objectPath,
    local_source_file: args.file,
    registered_at: now,
    ...extra
  };
  await client.query('BEGIN');
  const job = await client.query(
    `INSERT INTO kazika_studio_agents.generation_jobs
       (user_id, agent_story_scene_id, script_line_id, script_id, agent_conversation_id, agent_conversation_message_id, job_type, provider, model, status, prompt, input, output, metadata, started_at, completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,'audio',$7,$8,'completed',$9,$10,$11,$12,NOW(),NOW()) RETURNING id`,
    [args.userId, sceneId, scriptLineId, line.script_id, line.agent_conversation_id, line.agent_conversation_message_id, args.provider, meta.model, args.prompt || inputText,
     { text: inputText, character_id: line.agent_character_id, voice_profile_id: line.voice_profile_id, seed: line.voice_seed, no_split_sentences: true },
     { storage_path: objectPath, mime_type: mime, duration_seconds: audioInfo.duration_seconds, sample_rate_hz: audioInfo.sample_rate_hz }, meta]
  );
  const versionRes = await client.query(`SELECT COALESCE(MAX(version),0)+1 AS version FROM kazika_studio_agents.assets WHERE agent_story_scene_id=$1 AND asset_type='audio'`, [sceneId]);
  await client.query(`UPDATE kazika_studio_agents.assets SET is_primary=false, updated_at=NOW() WHERE agent_story_scene_id=$1 AND script_line_id=$2 AND asset_type='audio'`, [sceneId, scriptLineId]);
  const inserted = await client.query(
    `INSERT INTO kazika_studio_agents.assets
       (user_id, agent_story_scene_id, script_line_id, script_id, agent_conversation_id, agent_conversation_message_id, generation_job_id, asset_type, url, storage_path, mime_type, duration_seconds, file_size_bytes, version, is_primary, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'audio',$8,$8,$9,$10,$11,$12,true,$13) RETURNING id`,
    [args.userId, sceneId, scriptLineId, line.script_id, line.agent_conversation_id, line.agent_conversation_message_id, job.rows[0].id, objectPath, mime, audioInfo.duration_seconds, fileSize, versionRes.rows[0].version, meta]
  );
  let autoSwitchedVideoProvider = false;
  if (shouldSwitchToLongAudioLipSync(line, audioInfo)) {
    const switchAudit = {
      threshold_seconds: 6.0,
      audio_duration_seconds: audioInfo.duration_seconds,
      audio_asset_id: Number(inserted.rows[0].id),
      provider: 'ltx_2_3_lipsync_fp8',
      previous_provider: line.video_generation_provider,
      switched_at: now,
      source: 'register-scene-line-audio.mjs'
    };
    await client.query(
      `UPDATE kazika_studio_agents.script_lines
          SET video_generation_provider = 'ltx_2_3_lipsync_fp8',
              metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{long_audio_provider_auto_switch}', $2::jsonb, true),
              updated_at = NOW()
        WHERE id = $1
          AND coalesce(video_generation_provider, '') <> 'none'
          AND coalesce(metadata->>'final_render_mode', '') <> 'still_image_3s'`,
      [scriptLineId, JSON.stringify(switchAudit)]
    );
    autoSwitchedVideoProvider = true;
  }
  await client.query('COMMIT');
  console.log(JSON.stringify({ sceneId, scriptLineId, assetId: Number(inserted.rows[0].id), storagePath: objectPath, duration_seconds: audioInfo.duration_seconds, duration_probe: audioInfo.duration_probe, autoSwitchedVideoProvider, agentSceneUrl: `${args.productionBaseUrl.replace(/\/$/,'')}/agent-scenes/${sceneId}` }, null, 2));
} catch (e) { try { await client.query('ROLLBACK'); } catch {} throw e; } finally { await client.end(); }
