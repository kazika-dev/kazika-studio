'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, Clapperboard, Clock, Copy, Film, ImageIcon, Layers, Mic2, ScrollText, Sparkles } from 'lucide-react';

type AnyRow = Record<string, ReactNode>;

type ScenePayload = {
  scene: AnyRow;
  scripts: AnyRow[];
  scriptLines: AnyRow[];
  conversations: AnyRow[];
  shots: AnyRow[];
  assets: AnyRow[];
  timelineTracks: AnyRow[];
  generationJobs: AnyRow[];
  sceneLayouts: AnyRow[];
};

export default function AgentSceneDetailPage() {
  const params = useParams();
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const sceneId = idParam ? Number.parseInt(idParam, 10) : NaN;

  const [data, setData] = useState<ScenePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!Number.isFinite(sceneId)) {
      setError('無効なシーンIDです');
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/agent-scenes/${sceneId}`);
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'シーンの取得に失敗しました');
        }
        setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'シーンの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [sceneId]);

  const assetGroups = useMemo(() => {
    const groups: Record<string, AnyRow[]> = {};
    for (const asset of data?.assets || []) {
      const key = typeof asset.asset_type === 'string' ? asset.asset_type : 'unknown';
      groups[key] = groups[key] || [];
      groups[key].push(asset);
    }
    return groups;
  }, [data?.assets]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl">
          <div className="h-8 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="mt-6 h-56 animate-pulse rounded-3xl bg-white dark:bg-slate-900" />
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950">
        <div className="mx-auto max-w-3xl">
          <Link href="/agent-scenes" className="mb-4 inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-300">
            <ArrowLeft size={16} /> 新シーン一覧へ
          </Link>
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <p>{error || 'シーンが見つかりません'}</p>
          </div>
        </div>
      </main>
    );
  }

  const { scene, scripts, scriptLines, conversations, shots, assets, timelineTracks, generationJobs, sceneLayouts } = data;
  const layoutAssets = assets.filter((asset) => asset.asset_type === 'layout_reference' || asset.asset_type === 'placement_diagram');

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl">
        <Link href="/agent-scenes" className="mb-4 inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-300">
          <ArrowLeft size={16} /> 新シーン一覧へ
        </Link>

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-600 dark:text-indigo-300">{scene.story_title}</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{scene.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                {scene.summary || scene.description || 'シーン概要は未設定です。'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                {scene.location && <Badge>{scene.location}</Badge>}
                {scene.time_of_day && <Badge>{scene.time_of_day}</Badge>}
                {scene.mood && <Badge>{scene.mood}</Badge>}
                {scene.source_story_scene_id && <Badge>source #{scene.source_story_scene_id}</Badge>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[420px]">
              <Stat icon={<ScrollText size={17} />} label="台本" value={scripts.length} />
              <Stat icon={<Clapperboard size={17} />} label="ショット" value={shots.length} />
              <Stat icon={<Layers size={17} />} label="素材" value={assets.length} />
              <Stat icon={<Sparkles size={17} />} label="生成Job" value={generationJobs.length} />
            </div>
          </div>
        </section>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="min-w-0 space-y-6">
            <Panel title="台本 / セリフ" icon={<ScrollText size={18} />}>
              {scripts.length === 0 && scriptLines.length === 0 ? (
                <Empty>まだ scripts / script_lines がありません。</Empty>
              ) : (
                <div className="space-y-5">
                  {scripts.map((script) => (
                    <div key={String(script.id)} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">{script.title}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">v{script.version} / {script.status} / {script.line_count || 0} lines</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {scriptLines.filter((line) => line.script_id === script.id).map((line) => {
                          const lineAudioAssets = assets.filter((asset) => asset.asset_type === 'audio' && asset.script_line_id === line.id);
                          return (
                            <div key={String(line.id)} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-950">
                              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <span>#{line.line_index}</span>
                                <span>{line.line_type}</span>
                                {line.speaker_name && <span className="font-medium text-indigo-600 dark:text-indigo-300">{line.speaker_name}</span>}
                                {lineAudioAssets.length > 0 && <span className="inline-flex items-center gap-1"><Mic2 size={13} /> {lineAudioAssets.length}</span>}
                              </div>
                              <p className="leading-6 text-slate-800 dark:text-slate-100">{line.text}</p>
                              {line.tts_text && line.tts_text !== line.text && (
                                <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">TTS: {line.tts_text}</p>
                              )}
                              {lineAudioAssets.length > 0 && (
                                <div className="mt-3 space-y-2">
                                  {lineAudioAssets.map((asset) => (
                                    <AudioPlayer key={String(asset.id)} asset={asset} compact />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="ショット" icon={<Clapperboard size={18} />}>
              {shots.length === 0 ? (
                <Empty>まだ shots がありません。</Empty>
              ) : (
                <div className="space-y-3">
                  {shots.map((shot) => (
                    <div key={String(shot.id)} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Shot #{shot.shot_index}</p>
                          <h3 className="font-semibold text-slate-900 dark:text-white">{shot.title || 'Untitled shot'}</h3>
                          {shot.description && <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{shot.description}</p>}
                        </div>
                        <Badge>{shot.asset_count || 0} assets</Badge>
                      </div>
                      {(shot.image_prompt || shot.video_prompt) && (
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {shot.image_prompt && <PromptBox label="image prompt" text={String(shot.image_prompt)} />}
                          {shot.video_prompt && <PromptBox label="video prompt" text={String(shot.video_prompt)} />}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="min-w-0 space-y-6">
            <Panel title="キャラクター配置図" icon={<Layers size={18} />}>
              {sceneLayouts.length === 0 && layoutAssets.length === 0 ? (
                <Empty>まだ配置図がありません。シーン作成時に layout_reference asset として登録します。</Empty>
              ) : (
                <div className="space-y-3">
                  {sceneLayouts.slice(0, 3).map((layout) => (
                    <SceneLayoutCard key={String(layout.id)} layout={layout} />
                  ))}
                  {layoutAssets.length > 0 && (
                    <div className="space-y-2">
                      {layoutAssets.slice(0, 3).map((asset) => (
                        <AssetRow key={String(asset.id)} asset={asset} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Panel>

            <Panel title="素材" icon={<Layers size={18} />}>
              {assets.length === 0 ? (
                <Empty>まだ assets がありません。</Empty>
              ) : (
                <div className="space-y-4">
                  {Object.entries(assetGroups).map(([type, rows]) => (
                    <div key={type}>
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                        {assetIcon(type)} {type} <span className="text-xs text-slate-400">{rows.length}</span>
                      </h3>
                      <div className="space-y-2">
                        {rows.slice(0, 8).map((asset) => (
                          <AssetRow key={String(asset.id)} asset={asset} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="会話 / タイムライン / Jobs" icon={<Clock size={18} />}>
              <div className="grid gap-3">
                <MiniCount label="Conversations" value={conversations.length} />
                <MiniCount label="Timeline tracks" value={timelineTracks.length} />
                <MiniCount label="Generation jobs" value={generationJobs.length} />
              </div>
              {generationJobs.length > 0 && (
                <div className="mt-4 space-y-2">
                  {generationJobs.slice(0, 8).map((job) => (
                    <div key={String(job.id)} className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-950">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-800 dark:text-slate-100">{job.job_type}</span>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{job.status}</span>
                      </div>
                      <p className="mt-1 text-slate-500 dark:text-slate-400">{job.provider}{job.model ? ` / ${job.model}` : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </main>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <h2 className="mb-4 flex min-w-0 items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">{icon}{title}</h2>
      {children}
    </section>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 text-center dark:bg-slate-950">
      <div className="mx-auto mb-1 flex justify-center text-indigo-500">{icon}</div>
      <div className="text-xl font-bold text-slate-900 dark:text-white">{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{children}</span>;
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">{children}</div>;
}

function PromptBox({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="line-clamp-4 text-xs leading-5 text-slate-600 dark:text-slate-300">{text}</p>
    </div>
  );
}

function MiniCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950">
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
      <span className="font-semibold text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}


function SceneLayoutCard({ layout }: { layout: AnyRow }) {
  const characters = Array.isArray(layout.characters) ? layout.characters : [];
  const anchors = Array.isArray(layout.anchors) ? layout.anchors : [];
  const assetId = layout.asset_id || layout.linked_asset_id;
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 text-xs dark:border-indigo-950 dark:bg-indigo-950/30">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900 dark:text-white">{layout.title || 'キャラクター配置図'}</h3>
            {layout.is_active && <Badge>active</Badge>}
            {layout.version != null && <Badge>v{layout.version}</Badge>}
          </div>
          {layout.spatial_notes && <p className="mt-2 leading-5 text-slate-600 dark:text-slate-300">{String(layout.spatial_notes)}</p>}
        </div>
        {assetId && <CopyAssetIdButton assetId={assetId} />}
      </div>
      {(characters.length > 0 || anchors.length > 0) && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {characters.length > 0 && <JsonList label="characters" items={characters} />}
          {anchors.length > 0 && <JsonList label="space anchors" items={anchors} />}
        </div>
      )}
      <p className="mt-3 rounded-lg bg-white/70 px-2 py-1 text-[11px] leading-5 text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
        配置図は相対位置・空間関係だけを参照。キャラ外見はキャラシ、画角/カメラワークは各ショット指示を優先。
      </p>
    </div>
  );
}

function JsonList({ label, items }: { label: string; items: unknown[] }) {
  return (
    <div className="rounded-lg bg-white/70 p-2 dark:bg-slate-900/70">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <ul className="space-y-1 text-slate-600 dark:text-slate-300">
        {items.slice(0, 5).map((item, index) => (
          <li key={index} className="line-clamp-2">{compactJson(item)}</li>
        ))}
      </ul>
    </div>
  );
}

function compactJson(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.entries(record)
      .slice(0, 4)
      .map(([key, val]) => `${key}: ${typeof val === 'object' ? JSON.stringify(val) : String(val)}`)
      .join(' / ');
  }
  return String(value);
}

function AssetRow({ asset }: { asset: AnyRow }) {
  const isAudio = asset.asset_type === 'audio';
  const isImage = asset.asset_type === 'image' || asset.asset_type === 'thumbnail' || asset.asset_type === 'storyboard' || asset.asset_type === 'layout_reference' || asset.asset_type === 'placement_diagram';
  const src = assetUrl(asset);
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
      {isImage && src && (
        <a href={src} target="_blank" rel="noreferrer" className="mb-3 block max-w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-950">
          <img src={src} alt={`asset ${String(asset.id)}`} className="aspect-[3/4] h-auto w-full max-w-full object-cover transition hover:scale-[1.01]" loading="lazy" />
        </a>
      )}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">asset #{asset.id}</span>
        <div className="flex shrink-0 items-center gap-2">
          <CopyAssetIdButton assetId={asset.id} />
          {asset.is_primary && <Badge>primary</Badge>}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap gap-2 text-slate-500 dark:text-slate-400">
        {asset.shot_index != null && <span>shot #{asset.shot_index}</span>}
        {asset.line_index != null && <span>line #{asset.line_index}</span>}
        {asset.speaker_name && <span>{asset.speaker_name}</span>}
        {asset.duration_seconds != null && <span>{Number(asset.duration_seconds).toFixed(1)}s</span>}
        {asset.generation_status && <span>{asset.generation_status}</span>}
      </div>
      {isAudio && <AudioPlayer asset={asset} />}
      {!isAudio && src && (
        <a href={src} target="_blank" rel="noreferrer" className="mt-2 block truncate text-indigo-600 hover:underline dark:text-indigo-300">
          {String(asset.storage_path || asset.url || src)}
        </a>
      )}
    </div>
  );
}

function AudioPlayer({ asset, compact = false }: { asset: AnyRow; compact?: boolean }) {
  const src = assetUrl(asset);
  if (!src) return null;
  return (
    <div className={compact ? 'min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900' : 'mt-3 min-w-0 overflow-hidden'}>
      {compact && (
        <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">asset #{asset.id}</span>
          <CopyAssetIdButton assetId={asset.id} />
        </div>
      )}
      <audio controls preload="none" src={src} className="h-9 w-full max-w-full" />
      <a href={src} target="_blank" rel="noreferrer" className="mt-1 block truncate text-[11px] text-indigo-600 hover:underline dark:text-indigo-300">
        {String(asset.storage_path || asset.url || src)}
      </a>
    </div>
  );
}


function CopyAssetIdButton({ assetId }: { assetId: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const value = String(assetId ?? '');

  const copy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!value}
      title="asset_idをコピー"
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:border-indigo-800 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'copied' : 'copy id'}
    </button>
  );
}

function assetUrl(asset: AnyRow) {
  const raw = typeof asset.url === 'string' && asset.url ? asset.url : typeof asset.storage_path === 'string' ? asset.storage_path : '';
  if (!raw) return '';
  if (/^https?:\/\//.test(raw) || raw.startsWith('/api/storage/')) return raw;
  const clean = raw.replace(/^\/+/, '').replace(/^api\/storage\//, '');
  return `/api/storage/${clean.split('/').map(encodeURIComponent).join('/')}`;
}

function assetIcon(type: string) {
  if (type.includes('audio')) return <Mic2 size={16} />;
  if (type.includes('video')) return <Film size={16} />;
  if (type.includes('image') || type.includes('thumbnail') || type.includes('layout') || type.includes('diagram')) return <ImageIcon size={16} />;
  return <Layers size={16} />;
}
