'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, Check, Clapperboard, Clock, Copy, Download, Eye, EyeOff, Film, ImageIcon, Layers, Maximize2, Mic2, ScrollText, Link2, Sparkles, Subtitles, Unlink, Users, X } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

type ScenePayload = {
  scene: AnyRow;
  scripts: AnyRow[];
  scriptLines: AnyRow[];
  characters: AnyRow[];
  conversations: AnyRow[];
  shots: AnyRow[];
  assets: AnyRow[];
  timelineTracks: AnyRow[];
  timelineClips: AnyRow[];
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
  const [showAssetHistory, setShowAssetHistory] = useState(false);
  const [savingDisplayAssetId, setSavingDisplayAssetId] = useState('');
  const [savingLinkAssetId, setSavingLinkAssetId] = useState('');
  const [savingPrimaryAssetId, setSavingPrimaryAssetId] = useState('');
  const [savingDialogueLineId, setSavingDialogueLineId] = useState('');
  const [displayError, setDisplayError] = useState('');
  const [linkError, setLinkError] = useState('');
  const [primaryError, setPrimaryError] = useState('');
  const [dialogueError, setDialogueError] = useState('');
  const [subtitleError, setSubtitleError] = useState('');
  const [savingSubtitles, setSavingSubtitles] = useState(false);
  const [savingSubtitleClipId, setSavingSubtitleClipId] = useState('');
  const [renderingSubtitleAssetId, setRenderingSubtitleAssetId] = useState('');
  const [renderingFinalSubtitledVideo, setRenderingFinalSubtitledVideo] = useState(false);

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

  const currentAssets = useMemo(() => {
    const allAssets = data?.assets || [];
    const activeLayoutAssetIds = new Set((data?.sceneLayouts || []).map((layout) => String(layout.asset_id || '')));
    const imageAssets = allAssets.filter((asset) => isSceneImageAsset(asset));
    const latestImageCreatedAt = imageAssets[0]?.created_at ? String(imageAssets[0].created_at) : '';
    const imageDisplayConfigured = imageAssets.some((asset) => hasSceneImageDisplayConfig(asset));

    return allAssets.filter((asset) => {
      const type = String(asset.asset_type || 'unknown');
      if (type === 'layout_reference' || type === 'placement_diagram') {
        return Boolean(asset.is_primary) || activeLayoutAssetIds.has(String(asset.id));
      }
      if (type === 'audio') return Boolean(asset.is_primary);
      if (isSceneImageAsset(asset)) {
        return imageDisplayConfigured
          ? isSceneImageEnabled(asset)
          : latestImageCreatedAt ? String(asset.created_at) === latestImageCreatedAt : Boolean(asset.is_primary);
      }
      if (isRenderedFinalVideoAsset(asset)) return true;
      return Boolean(asset.is_primary);
    }).sort(sortSceneAssets);
  }, [data?.assets, data?.sceneLayouts]);

  const visibleAssets = useMemo(() => (showAssetHistory ? data?.assets || [] : currentAssets), [currentAssets, data?.assets, showAssetHistory]);

  const materialAssets = useMemo(
    () => visibleAssets.filter((asset) => !(asset.asset_type === 'audio' && asset.script_line_id) && !isStoryboardAsset(asset)).sort(sortSceneAssets),
    [visibleAssets]
  );

  const sceneImageAssets = useMemo(
    () => (data?.assets || []).filter((asset) => isSceneImageAsset(asset)).sort(sortSceneAssets),
    [data?.assets]
  );

  const imageDisplayConfigured = useMemo(
    () => sceneImageAssets.some((asset) => hasSceneImageDisplayConfig(asset)),
    [sceneImageAssets]
  );

  const enabledSceneImageAssets = useMemo(
    () => (imageDisplayConfigured ? sceneImageAssets.filter((asset) => isSceneImageEnabled(asset)) : currentAssets.filter((asset) => isSceneImageAsset(asset))).sort(sortSceneAssets),
    [currentAssets, imageDisplayConfigured, sceneImageAssets]
  );

  const assetGroups = useMemo(() => {
    const groups: Record<string, AnyRow[]> = {};
    for (const asset of materialAssets) {
      const key = typeof asset.asset_type === 'string' ? asset.asset_type : 'unknown';
      groups[key] = groups[key] || [];
      groups[key].push(asset);
    }
    for (const key of Object.keys(groups)) {
      groups[key] = groups[key].sort(sortSceneAssets);
    }
    return groups;
  }, [materialAssets]);


  const relinkableAssets = useMemo(
    () => (data?.assets || []).filter((asset) => isRelinkableAsset(asset)).sort(sortSceneAssets),
    [data?.assets]
  );

  const assetsByLineId = useMemo(() => {
    const groups = new Map<string, AnyRow[]>();
    for (const asset of relinkableAssets) {
      const lineId = asset.script_line_id == null ? '' : String(asset.script_line_id);
      if (!lineId) continue;
      const rows = groups.get(lineId) || [];
      rows.push(asset);
      groups.set(lineId, rows);
    }
    for (const [lineId, rows] of groups) {
      groups.set(lineId, rows.sort(sortLinkedLineAssets));
    }
    return groups;
  }, [relinkableAssets]);

  const persistAssetLineLink = async (asset: AnyRow, nextLineId: string) => {
    if (!Number.isFinite(sceneId)) return;
    const assetId = String(asset.id || '');
    if (!assetId) return;
    setSavingLinkAssetId(assetId);
    setLinkError('');
    try {
      const response = await fetch(`/api/agent-scenes/${sceneId}/assets`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkUpdates: [{
            asset_id: asset.id,
            script_line_id: nextLineId || null,
          }],
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '素材の紐付け保存に失敗しました');
      }
      const linkedById = new Map<string, AnyRow>((result.data?.linkedAssets || []).map((row: AnyRow) => [String(row.id), row]));
      setData((current) => current ? {
        ...current,
        assets: current.assets.map((row) => linkedById.get(String(row.id)) || row),
      } : current);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : '素材の紐付け保存に失敗しました');
    } finally {
      setSavingLinkAssetId('');
    }
  };

  const persistDialoguePrimaryAsset = async (asset: AnyRow) => {
    if (!Number.isFinite(sceneId)) return;
    const assetId = String(asset.id || '');
    if (!assetId) return;
    setSavingPrimaryAssetId(assetId);
    setPrimaryError('');
    try {
      const response = await fetch(`/api/agent-scenes/${sceneId}/assets`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryUpdates: [{ asset_id: asset.id }],
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'primary変更に失敗しました');
      }
      const primaryById = new Map<string, AnyRow>((result.data?.primaryAssets || []).map((row: AnyRow) => [String(row.id), row]));
      setData((current) => current ? {
        ...current,
        assets: current.assets.map((row) => primaryById.get(String(row.id)) || row),
      } : current);
    } catch (err) {
      setPrimaryError(err instanceof Error ? err.message : 'primary変更に失敗しました');
    } finally {
      setSavingPrimaryAssetId('');
    }
  };

  const persistDialogueLine = async (line: AnyRow, nextText: string, nextTtsText: string) => {
    if (!Number.isFinite(sceneId)) return;
    const lineId = String(line.id || '');
    if (!lineId) return;
    setSavingDialogueLineId(lineId);
    setDialogueError('');
    try {
      const response = await fetch(`/api/agent-scenes/${sceneId}/script-lines/${lineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: nextText,
          tts_text: nextTtsText,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '会話の保存に失敗しました');
      }
      const updatedLine = result.data?.scriptLine;
      const updatedScript = result.data?.script;
      setData((current) => current ? {
        ...current,
        scripts: updatedScript
          ? current.scripts.map((script) => String(script.id) === String(updatedScript.id) ? { ...script, ...updatedScript } : script)
          : current.scripts,
        scriptLines: updatedLine
          ? current.scriptLines.map((row) => String(row.id) === String(updatedLine.id) ? { ...row, ...updatedLine } : row)
          : current.scriptLines,
      } : current);
    } catch (err) {
      setDialogueError(err instanceof Error ? err.message : '会話の保存に失敗しました');
    } finally {
      setSavingDialogueLineId('');
    }
  };

  const persistSceneImageSettings = async (nextAssets: AnyRow[], targetAssetId: string) => {
    if (!Number.isFinite(sceneId)) return;
    setSavingDisplayAssetId(targetAssetId);
    setDisplayError('');
    try {
      const response = await fetch(`/api/agent-scenes/${sceneId}/assets`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: nextAssets.map((asset, index) => ({
            id: asset.id,
            scene_image_enabled: isSceneImageEnabled(asset),
            scene_image_order: getSceneImageOrder(asset) || index + 1,
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '画像表示設定の保存に失敗しました');
      }
      const updatedById = new Map<string, AnyRow>((result.data?.assets || []).map((asset: AnyRow) => [String(asset.id), asset]));
      setData((current) => current ? {
        ...current,
        assets: current.assets.map((asset) => {
          const updated = updatedById.get(String(asset.id));
          return updated ? { ...asset, metadata: updated.metadata } : asset;
        }),
      } : current);
    } catch (err) {
      setDisplayError(err instanceof Error ? err.message : '画像表示設定の保存に失敗しました');
    } finally {
      setSavingDisplayAssetId('');
    }
  };

  const toggleSceneImage = (asset: AnyRow) => {
    const assetId = String(asset.id || '');
    const currentlyEnabledIds = new Set(enabledSceneImageAssets.map((item) => String(item.id)));
    const nextEnabled = !currentlyEnabledIds.has(assetId);
    const maxOrder = Math.max(0, ...enabledSceneImageAssets.map((item, index) => getSceneImageOrder(item) || index + 1));
    const nextAssets = sceneImageAssets.map((item) => {
      const itemId = String(item.id);
      const itemEnabled = itemId === assetId ? nextEnabled : currentlyEnabledIds.has(itemId);
      return {
        ...item,
        metadata: {
          ...assetMetadata(item),
          scene_image_enabled: itemEnabled,
          scene_image_order: getSceneImageOrder(item) || (itemEnabled ? maxOrder + 1 : sceneImageAssets.findIndex((candidate) => String(candidate.id) === itemId) + 1),
        },
      };
    });
    void persistSceneImageSettings(nextAssets, assetId);
  };

  const moveSceneImage = (asset: AnyRow, direction: -1 | 1) => {
    const assetId = String(asset.id || '');
    const enabled = enabledSceneImageAssets;
    const currentIndex = enabled.findIndex((item) => String(item.id) === assetId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= enabled.length) return;

    const reorderedEnabled = [...enabled];
    const [moved] = reorderedEnabled.splice(currentIndex, 1);
    reorderedEnabled.splice(nextIndex, 0, moved);
    const orderById = new Map(reorderedEnabled.map((item, index) => [String(item.id), index + 1]));
    const nextAssets = sceneImageAssets.map((item) => {
      const nextOrder = orderById.get(String(item.id));
      if (!nextOrder) return item;
      return {
        ...item,
        metadata: {
          ...assetMetadata(item),
          scene_image_enabled: true,
          scene_image_order: nextOrder,
        },
      };
    });
    void persistSceneImageSettings(nextAssets, assetId);
  };

  const syncSubtitleTrack = async () => {
    if (!Number.isFinite(sceneId)) return;
    setSavingSubtitles(true);
    setSubtitleError('');
    try {
      const response = await fetch(`/api/agent-scenes/${sceneId}/subtitles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-script-lines' }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '字幕トラック作成に失敗しました');
      }
      setData((current) => current ? {
        ...current,
        timelineTracks: result.data?.timelineTracks || current.timelineTracks,
        timelineClips: result.data?.timelineClips || current.timelineClips,
      } : current);
    } catch (err) {
      setSubtitleError(err instanceof Error ? err.message : '字幕トラック作成に失敗しました');
    } finally {
      setSavingSubtitles(false);
    }
  };

  const saveSubtitleClip = async (clip: AnyRow, nextText: string, nextEnabled: boolean) => {
    if (!Number.isFinite(sceneId)) return;
    const clipId = String(clip.id || '');
    if (!clipId) return;
    setSavingSubtitleClipId(clipId);
    setSubtitleError('');
    try {
      const response = await fetch(`/api/agent-scenes/${sceneId}/subtitles`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ clip_id: clip.id, text: nextText, enabled: nextEnabled }] }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '字幕保存に失敗しました');
      }
      setData((current) => current ? {
        ...current,
        timelineTracks: result.data?.timelineTracks || current.timelineTracks,
        timelineClips: result.data?.timelineClips || current.timelineClips,
      } : current);
    } catch (err) {
      setSubtitleError(err instanceof Error ? err.message : '字幕保存に失敗しました');
    } finally {
      setSavingSubtitleClipId('');
    }
  };

  const renderSubtitledVideo = async (asset: AnyRow) => {
    if (!Number.isFinite(sceneId)) return;
    const assetId = String(asset.id || '');
    if (!assetId) return;
    setRenderingSubtitleAssetId(assetId);
    setSubtitleError('');
    try {
      const response = await fetch(`/api/agent-scenes/${sceneId}/render-subtitled-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoAssetId: asset.id }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '字幕焼き込み書き出しに失敗しました');
      }
      const nextAsset = result.data?.asset;
      const nextJob = result.data?.generationJob;
      setData((current) => current ? {
        ...current,
        assets: nextAsset ? [nextAsset, ...current.assets] : current.assets,
        generationJobs: nextJob ? [nextJob, ...current.generationJobs] : current.generationJobs,
      } : current);
    } catch (err) {
      setSubtitleError(err instanceof Error ? err.message : '字幕焼き込み書き出しに失敗しました');
    } finally {
      setRenderingSubtitleAssetId('');
    }
  };

  const renderFinalSubtitledVideo = async () => {
    if (!Number.isFinite(sceneId)) return;
    setRenderingFinalSubtitledVideo(true);
    setSubtitleError('');
    try {
      const response = await fetch(`/api/agent-scenes/${sceneId}/render-final-subtitled-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '動画結合＋字幕焼き込みに失敗しました');
      }
      const nextAsset = result.data?.asset;
      const nextJob = result.data?.generationJob;
      setData((current) => current ? {
        ...current,
        assets: nextAsset ? [nextAsset, ...current.assets] : current.assets,
        generationJobs: nextJob ? [nextJob, ...current.generationJobs] : current.generationJobs,
      } : current);
    } catch (err) {
      setSubtitleError(err instanceof Error ? err.message : '動画結合＋字幕焼き込みに失敗しました');
    } finally {
      setRenderingFinalSubtitledVideo(false);
    }
  };


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

  const { scene, scripts, scriptLines, characters, conversations, shots, assets, timelineTracks, timelineClips, generationJobs, sceneLayouts } = data;
  const layoutAssets = visibleAssets.filter((asset) => asset.asset_type === 'layout_reference' || asset.asset_type === 'placement_diagram');
  const storyboardAssets = assets.filter(isStoryboardAsset).sort(sortSceneAssets);
  const subtitleClips = timelineClips.filter((clip) => String(clip.track_type || '') === 'text' || subtitleMetadata(clip).kind === 'subtitle');
  const finalSourceVideoCount = new Set(assets.filter(isFinalRenderSourceVideo).map((asset) => String(asset.script_line_id || asset.id))).size;

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
            <Panel title="登場キャラクター" icon={<Users size={18} />}>
              {characters.length === 0 ? (
                <Empty>まだ登場キャラクター情報がありません。</Empty>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {characters.map((character) => (
                    <CharacterCard key={String(character.id)} character={character} />
                  ))}
                </div>
              )}
            </Panel>

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

            <Panel title="絵コンテ" icon={<Clapperboard size={18} />}>
              {storyboardAssets.length === 0 ? (
                <Empty>まだ絵コンテがありません。storyboard asset として登録するとここに表示されます。</Empty>
              ) : (
                <div className="space-y-3">
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                    配置図の次に確認する連続絵コンテ。カメラ・芝居・シーンの流れを優先し、最終画は各ショット画像で詰めます。
                  </p>
                  {storyboardAssets.map((asset) => (
                    <AssetRow key={String(asset.id)} asset={asset} />
                  ))}
                </div>
              )}
            </Panel>

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
                          const lineAssets = assetsByLineId.get(String(line.id)) || [];
                          const lineImageAssets = lineAssets.filter((asset) => isVisualAsset(asset));
                          const lineAudioAssets = lineAssets.filter((asset) => asset.asset_type === 'audio');
                          const lineVideoAssets = lineAssets.filter((asset) => isVideoAsset(asset));
                          return (
                            <div key={String(line.id)} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-950">
                              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <span>#{line.line_index}</span>
                                <CopyDialogueIdButton dialogueId={line.id} />
                                <span>{line.line_type}</span>
                                {line.speaker_name && <span className="font-medium text-indigo-600 dark:text-indigo-300">{line.speaker_name}</span>}
                                <LinkedAssetCount icon={<ImageIcon size={13} />} count={lineImageAssets.length} />
                                <LinkedAssetCount icon={<Mic2 size={13} />} count={lineAudioAssets.length} />
                                <LinkedAssetCount icon={<Film size={13} />} count={lineVideoAssets.length} />
                              </div>
                              <EditableDialogueLine
                                line={line}
                                saving={savingDialogueLineId === String(line.id)}
                                onSave={persistDialogueLine}
                              />
                              <LineAssetBundle
                                line={line}
                                assets={lineAssets}
                                allAssets={relinkableAssets}
                                allLines={scriptLines}
                                savingLinkAssetId={savingLinkAssetId}
                                savingPrimaryAssetId={savingPrimaryAssetId}
                                onRelinkAsset={persistAssetLineLink}
                                onSetPrimaryAsset={persistDialoguePrimaryAsset}
                                subtitleClips={subtitleClips}
                                savingSubtitleClipId={savingSubtitleClipId}
                                renderingSubtitleAssetId={renderingSubtitleAssetId}
                                onSaveSubtitleClip={saveSubtitleClip}
                                onRenderSubtitledVideo={renderSubtitledVideo}
                              />
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
            <Panel title="素材" icon={<Layers size={18} />}>
              {assets.length === 0 ? (
                <Empty>まだ assets がありません。</Empty>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2 rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-950">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400">
                        {showAssetHistory ? `履歴を含めて ${materialAssets.length} 件表示中` : `使用中素材のみ ${materialAssets.length} 件表示中`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAssetHistory((value) => !value)}
                        className="rounded-full border border-slate-200 px-3 py-1 font-medium text-indigo-600 transition hover:border-indigo-200 hover:bg-indigo-50 dark:border-slate-700 dark:text-indigo-300 dark:hover:border-indigo-800 dark:hover:bg-indigo-950"
                      >
                        {showAssetHistory ? '履歴を隠す' : '履歴表示'}
                      </button>
                    </div>
                    <p className="leading-5 text-slate-500 dark:text-slate-400">
                      画像カードの「使う / 使わない」でシーン表示対象を切替、↑↓で使用画像の順番を保存できます。過去画像を使いたい時は履歴表示をON。
                    </p>
                    {displayError && <p className="text-red-600 dark:text-red-300">{displayError}</p>}
                    {linkError && <p className="text-red-600 dark:text-red-300">{linkError}</p>}
                    {primaryError && <p className="text-red-600 dark:text-red-300">{primaryError}</p>}
                    {dialogueError && <p className="text-red-600 dark:text-red-300">{dialogueError}</p>}
                    {subtitleError && <p className="text-red-600 dark:text-red-300">{subtitleError}</p>}
                  </div>
                  {Object.entries(assetGroups).map(([type, rows]) => (
                    <AssetGroupSection
                      key={type}
                      type={type}
                      rows={rows}
                      showAssetHistory={showAssetHistory}
                      enabledSceneImageAssets={enabledSceneImageAssets}
                      savingDisplayAssetId={savingDisplayAssetId}
                      allLines={scriptLines}
                      savingLinkAssetId={savingLinkAssetId}
                      onRelinkAsset={persistAssetLineLink}
                      onToggleSceneImage={toggleSceneImage}
                      onMoveSceneImage={moveSceneImage}
                      subtitleClips={subtitleClips}
                      savingSubtitleClipId={savingSubtitleClipId}
                      renderingSubtitleAssetId={renderingSubtitleAssetId}
                      onSaveSubtitleClip={saveSubtitleClip}
                      onRenderSubtitledVideo={renderSubtitledVideo}
                    />
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="会話 / タイムライン / Jobs" icon={<Clock size={18} />}>
              <div className="grid gap-3">
                <MiniCount label="Conversations" value={conversations.length} />
                <MiniCount label="Timeline tracks" value={timelineTracks.length} />
                <MiniCount label="Timeline clips" value={timelineClips.length} />
                <MiniCount label="Generation jobs" value={generationJobs.length} />
              </div>
              <SubtitleTools
                subtitleClips={subtitleClips}
                sourceVideoCount={finalSourceVideoCount}
                saving={savingSubtitles}
                renderingFinal={renderingFinalSubtitledVideo}
                error={subtitleError}
                onSync={syncSubtitleTrack}
                onRenderFinal={renderFinalSubtitledVideo}
              />
              {timelineTracks.length > 0 && (
                <div className="mt-4 space-y-3">
                  {timelineTracks.map((track) => {
                    const clips = timelineClips.filter((clip) => String(clip.track_id) === String(track.id));
                    return (
                      <div key={String(track.id)} className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            {assetIcon(String(track.track_type || ''))}
                            <span className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">{track.name || `Track #${track.id}`}</span>
                          </div>
                          <Badge>{String(track.track_type || 'track')} / {clips.length} clips</Badge>
                        </div>
                        {clips.length === 0 ? (
                          <p className="text-slate-500 dark:text-slate-400">まだクリップがありません。</p>
                        ) : (
                          <div className="space-y-2">
                            {clips.map((clip) => (
                              <TimelineClipRow key={String(clip.id)} clip={clip} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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



function CharacterCard({ character }: { character: AnyRow }) {
  const imageUrl = typeof character.image_url === 'string' ? storageUrl(character.image_url) : '';
  const metadata = character.metadata && typeof character.metadata === 'object' ? character.metadata : {};
  const illustrationUrl = typeof metadata.illustration_only_path === 'string' ? storageUrl(metadata.illustration_only_path) : '';
  const settingsUrl = typeof metadata.image_with_settings_path === 'string' ? storageUrl(metadata.image_with_settings_path) : imageUrl;
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<'settings' | 'illustration'>('settings');
  const activePreviewUrl = previewMode === 'illustration' && illustrationUrl ? illustrationUrl : settingsUrl;
  const characterName = String(character.name || 'character');

  useEffect(() => {
    if (!isPreviewOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsPreviewOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isPreviewOpen]);

  const openPreview = () => {
    if (!imageUrl) return;
    setPreviewMode('settings');
    setIsPreviewOpen(true);
  };

  return (
    <>
      <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-start gap-3">
          {imageUrl ? (
            <button
              type="button"
              onClick={openPreview}
              className="group relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-400 ring-offset-2 transition hover:ring-2 hover:ring-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:bg-slate-900 dark:ring-offset-slate-950"
              aria-label={`${characterName}のキャラシを拡大`}
            >
              <img src={imageUrl} alt={characterName} className="h-full w-full object-cover" loading="lazy" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition group-hover:opacity-100 group-focus:opacity-100">
                <Maximize2 size={16} className="text-white" />
              </span>
            </button>
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-900">
              <Users size={20} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate font-semibold text-slate-900 dark:text-white">{character.name}</h3>
              {character.is_favorite && <Badge>fav</Badge>}
            </div>
            {character.video_character_tag && <p className="mt-1 truncate text-[11px] text-indigo-600 dark:text-indigo-300">{String(character.video_character_tag)}</p>}
            {character.looks && <p className="mt-1 line-clamp-2 leading-5 text-slate-500 dark:text-slate-400">{String(character.looks)}</p>}
            {imageUrl && (
              <button
                type="button"
                onClick={openPreview}
                className="mt-2 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-200 dark:hover:bg-indigo-900/70"
              >
                <Maximize2 size={12} />
                キャラシ拡大
              </button>
            )}
          </div>
        </div>
      </div>

      {isPreviewOpen && imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`${characterName}のキャラクターシート`}
          onClick={() => setIsPreviewOpen(false)}
        >
          <div
            className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl dark:bg-slate-950"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Character sheet</p>
                <h2 className="truncate text-base font-semibold text-slate-900 dark:text-white">{characterName}</h2>
              </div>
              <div className="flex items-center gap-2">
                {illustrationUrl && (
                  <div className="flex rounded-full bg-slate-100 p-1 text-xs dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => setPreviewMode('settings')}
                      className={`rounded-full px-3 py-1 font-medium transition ${previewMode === 'settings' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                    >
                      設定付き
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode('illustration')}
                      className={`rounded-full px-3 py-1 font-medium transition ${previewMode === 'illustration' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                    >
                      イラストのみ
                    </button>
                  </div>
                )}
                <a
                  href={activePreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  別タブ
                </a>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="rounded-full bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  aria-label="閉じる"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-100 p-4 dark:bg-slate-900/70">
              <img src={activePreviewUrl} alt={`${characterName} character sheet`} className="max-h-[76vh] max-w-full rounded-xl object-contain shadow-lg" />
            </div>
            {(character.description || character.personality || character.looks) && (
              <div className="grid gap-2 border-t border-slate-200 p-4 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300 md:grid-cols-3">
                {character.description && <PromptBox label="説明" text={String(character.description)} />}
                {character.personality && <PromptBox label="性格" text={String(character.personality)} />}
                {character.looks && <PromptBox label="外見" text={String(character.looks)} />}
              </div>
            )}
          </div>
        </div>
      )}
    </>
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

function isSceneImageAsset(asset: AnyRow) {
  const type = String(asset.asset_type || '');
  return type === 'image' || type === 'thumbnail';
}

function isStoryboardAsset(asset: AnyRow) {
  return String(asset.asset_type || '') === 'storyboard';
}

function isVisualAsset(asset: AnyRow) {
  const type = String(asset.asset_type || '');
  return type === 'image' || type === 'thumbnail' || type === 'storyboard';
}

function isVideoAsset(asset: AnyRow) {
  const type = String(asset.asset_type || '');
  return type === 'video' || type === 'talking_video' || type === 'synced_video' || type === 'final_video' || String(asset.mime_type || '').includes('video');
}

function isRenderedFinalVideoAsset(asset: AnyRow) {
  if (!isVideoAsset(asset)) return false;
  const metadata = assetMetadata(asset);
  return String(asset.asset_type || '') === 'final_video' || metadata.final_concat === true || metadata.final_concat === 'true';
}

function isFinalRenderSourceVideo(asset: AnyRow) {
  if (!isVideoAsset(asset)) return false;
  if (isRenderedFinalVideoAsset(asset)) return false;
  if (asset.script_line_id == null) return false;
  const burnedIn = assetMetadata(asset).burned_in_subtitles;
  return burnedIn !== true && burnedIn !== 'true';
}

function canRemakeCheckAsset(asset: AnyRow) {
  return isVisualAsset(asset) || asset.asset_type === 'audio' || isVideoAsset(asset);
}

function isRelinkableAsset(asset: AnyRow) {
  return isVisualAsset(asset) || asset.asset_type === 'audio' || isVideoAsset(asset);
}

function assetKindLabel(asset: AnyRow) {
  if (asset.asset_type === 'audio') return '音声';
  if (isVideoAsset(asset)) return '動画';
  if (isVisualAsset(asset)) return '画像';
  return String(asset.asset_type || '素材');
}

function sortLinkedLineAssets(a: AnyRow, b: AnyRow) {
  const order = (assetTypeOrder(a) - assetTypeOrder(b));
  if (order !== 0) return order;
  return sortSceneAssets(a, b);
}

function assetTypeOrder(asset: AnyRow) {
  if (isVisualAsset(asset)) return 1;
  if (asset.asset_type === 'audio') return 2;
  if (isVideoAsset(asset)) return 3;
  return 9;
}

function assetMetadata(asset: AnyRow): Record<string, unknown> {
  return isRecord(asset.metadata) ? asset.metadata : {};
}

function subtitleMetadata(clip: AnyRow): Record<string, unknown> {
  return isRecord(clip.metadata) ? clip.metadata : {};
}

function subtitleText(clip: AnyRow) {
  const metadata = subtitleMetadata(clip);
  const raw = metadata.text ?? clip.text ?? clip.title ?? '';
  return typeof raw === 'string' ? raw : String(raw ?? '');
}

function clipLocalStartMs(clip: AnyRow) {
  const metadata = subtitleMetadata(clip);
  const raw = metadata.local_start_ms ?? clip.source_start_ms ?? clip.start_time_ms ?? 0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function clipLocalEndMs(clip: AnyRow) {
  const metadata = subtitleMetadata(clip);
  const raw = metadata.local_end_ms ?? clip.source_end_ms ?? clip.end_time_ms ?? 0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function subtitleClipsForAsset(asset: AnyRow, subtitleClips: AnyRow[]) {
  const metadata = assetMetadata(asset);
  if (metadata.burned_in_subtitles === true || metadata.burned_in_subtitles === 'true') return [];
  const lineId = asset.script_line_id == null ? '' : String(asset.script_line_id);
  const sourceVideoAssetId = metadata.source_video_asset_id;
  return subtitleClips
    .filter((clip) => {
      if (subtitleMetadata(clip).enabled === false) return false;
      if (!subtitleText(clip).trim()) return false;
      if (lineId && clip.script_line_id != null) return String(clip.script_line_id) === lineId;
      if (sourceVideoAssetId && clip.asset_id != null) return String(clip.asset_id) === String(sourceVideoAssetId);
      return !lineId;
    })
    .sort((a, b) => clipLocalStartMs(a) - clipLocalStartMs(b));
}

function activeSubtitleAt(subtitleClips: AnyRow[], currentMs: number) {
  return subtitleClips.find((clip) => {
    if (subtitleMetadata(clip).enabled === false || !subtitleText(clip).trim()) return false;
    const start = clipLocalStartMs(clip);
    const end = Math.max(clipLocalEndMs(clip), start + 300);
    return currentMs >= start && currentMs <= end;
  });
}

function hasSceneImageDisplayConfig(asset: AnyRow) {
  const metadata = assetMetadata(asset);
  return typeof metadata.scene_image_enabled === 'boolean' || metadata.scene_image_order != null;
}

function isSceneImageEnabled(asset: AnyRow) {
  const metadata = assetMetadata(asset);
  return metadata.scene_image_enabled !== false;
}

function getSceneImageOrder(asset: AnyRow) {
  const metadata = assetMetadata(asset);
  const raw = metadata.scene_image_order;
  const order = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(order) && order > 0 ? order : 0;
}

function sortSceneAssets(a: AnyRow, b: AnyRow) {
  const aIsImage = isSceneImageAsset(a);
  const bIsImage = isSceneImageAsset(b);
  if (aIsImage && bIsImage) {
    const aOrder = getSceneImageOrder(a);
    const bOrder = getSceneImageOrder(b);
    if (aOrder || bOrder) return (aOrder || Number.MAX_SAFE_INTEGER) - (bOrder || Number.MAX_SAFE_INTEGER);
  }
  const aCreated = Date.parse(String(a.created_at || '')) || 0;
  const bCreated = Date.parse(String(b.created_at || '')) || 0;
  if (aCreated !== bCreated) return bCreated - aCreated;
  return Number(b.id || 0) - Number(a.id || 0);
}

type AssetRowProps = {
  asset: AnyRow;
  enabledSceneImageAssets?: AnyRow[];
  savingDisplayAssetId?: string;
  allLines?: AnyRow[];
  savingLinkAssetId?: string;
  subtitleClips?: AnyRow[];
  savingSubtitleClipId?: string;
  renderingSubtitleAssetId?: string;
  onRelinkAsset?: (asset: AnyRow, nextLineId: string) => void;
  onToggleSceneImage?: (asset: AnyRow) => void;
  onMoveSceneImage?: (asset: AnyRow, direction: -1 | 1) => void;
  onSaveSubtitleClip?: (clip: AnyRow, nextText: string, nextEnabled: boolean) => void;
  onRenderSubtitledVideo?: (asset: AnyRow) => void;
};

type AssetGroupSectionProps = Omit<AssetRowProps, 'asset'> & {
  type: string;
  rows: AnyRow[];
  showAssetHistory: boolean;
};

function AssetGroupSection({ type, rows, showAssetHistory, ...assetRowProps }: AssetGroupSectionProps) {
  const [showNonPrimary, setShowNonPrimary] = useState(false);
  const primaryRows = rows.filter((asset) => Boolean(asset.is_primary));
  const nonPrimaryRows = rows.filter((asset) => !asset.is_primary);
  const visibleRows = [...primaryRows, ...(showNonPrimary ? nonPrimaryRows : [])];
  const cappedRows = visibleRows.slice(0, showAssetHistory ? 50 : 8);
  const hiddenCount = nonPrimaryRows.length;
  const hiddenByLimitCount = Math.max(0, visibleRows.length - cappedRows.length);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          {assetIcon(type)} {type} <span className="text-xs text-slate-400">{rows.length}</span>
        </h3>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowNonPrimary((value) => !value)}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-800 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
          >
            {showNonPrimary ? <EyeOff size={12} /> : <Eye size={12} />}
            {showNonPrimary ? `primary以外を隠す (${hiddenCount})` : `primary以外を表示 (${hiddenCount})`}
          </button>
        )}
      </div>
      {cappedRows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400 dark:border-slate-800">
          primary素材なし。必要なら「primary以外を表示」で候補を確認できます。
        </p>
      ) : (
        <div className="space-y-2">
          {cappedRows.map((asset) => (
            <AssetRow key={String(asset.id)} asset={asset} {...assetRowProps} />
          ))}
          {hiddenByLimitCount > 0 && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              表示上限のため、さらに {hiddenByLimitCount} 件を省略中。
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AssetRow({ asset, enabledSceneImageAssets = [], savingDisplayAssetId = '', allLines = [], savingLinkAssetId = '', subtitleClips = [], savingSubtitleClipId = '', renderingSubtitleAssetId = '', onRelinkAsset, onToggleSceneImage, onMoveSceneImage, onSaveSubtitleClip, onRenderSubtitledVideo }: AssetRowProps) {
  const isAudio = asset.asset_type === 'audio';
  const isVideo = isVideoAsset(asset);
  const isImage = asset.asset_type === 'image' || asset.asset_type === 'thumbnail' || asset.asset_type === 'storyboard' || asset.asset_type === 'layout_reference' || asset.asset_type === 'placement_diagram';
  const shouldContainImage = asset.asset_type === 'storyboard' || asset.asset_type === 'layout_reference' || asset.asset_type === 'placement_diagram';
  const canRemakeCheck = canRemakeCheckAsset(asset);
  const canEditSceneImageDisplay = isSceneImageAsset(asset) && Boolean(onToggleSceneImage && onMoveSceneImage);
  const src = assetUrl(asset);
  const downloadSrc = storageDownloadUrl(src);
  const assetSubtitleClips = subtitleClipsForAsset(asset, subtitleClips);
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
      {isImage && src && (
        <a href={src} target="_blank" rel="noreferrer" className="mb-3 block max-w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-950">
          <img src={src} alt={`asset ${String(asset.id)}`} className={`${shouldContainImage ? 'aspect-square object-contain' : 'aspect-[3/4] object-cover'} h-auto w-full max-w-full transition hover:scale-[1.01]`} loading="lazy" />
        </a>
      )}
      {isVideo && src && <VideoPlayer asset={asset} subtitleClips={assetSubtitleClips} />}
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
      {isRelinkableAsset(asset) && onRelinkAsset && (
        <AssetLineLinkControl
          asset={asset}
          allLines={allLines}
          saving={savingLinkAssetId === String(asset.id)}
          onChange={(nextLineId) => onRelinkAsset(asset, nextLineId)}
        />
      )}
      {canEditSceneImageDisplay && (
        <SceneImageDisplayControl
          asset={asset}
          enabledSceneImageAssets={enabledSceneImageAssets}
          saving={savingDisplayAssetId === String(asset.id)}
          onToggle={() => onToggleSceneImage?.(asset)}
          onMove={(direction) => onMoveSceneImage?.(asset, direction)}
        />
      )}
      {isVideo && (
        <SubtitleVideoControls
          asset={asset}
          subtitleClips={assetSubtitleClips}
          savingSubtitleClipId={savingSubtitleClipId}
          rendering={renderingSubtitleAssetId === String(asset.id)}
          onSaveSubtitleClip={onSaveSubtitleClip}
          onRenderSubtitledVideo={onRenderSubtitledVideo}
        />
      )}
      {canRemakeCheck && <RemakeCheckControl asset={asset} />}
      {isAudio && <AudioPlayer asset={asset} />}
      {!isAudio && src && (
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
          <a href={src} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-indigo-600 hover:underline dark:text-indigo-300">
            {String(asset.storage_path || asset.url || src)}
          </a>
          {isVideo && (
            <a href={downloadSrc} className="shrink-0 rounded-full border border-indigo-200 px-3 py-1 text-[11px] font-medium text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-200 dark:hover:bg-indigo-950">
              DL
            </a>
          )}
        </div>
      )}
    </div>
  );
}


function EditableDialogueLine({
  line,
  saving,
  onSave,
}: {
  line: AnyRow;
  saving: boolean;
  onSave: (line: AnyRow, nextText: string, nextTtsText: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(line.text || ''));
  const [ttsText, setTtsText] = useState(String(line.tts_text || line.text || ''));
  const [customTts, setCustomTts] = useState(false);
  const savedText = String(line.text || '');
  const savedTtsText = String(line.tts_text || line.text || '');
  const hasCustomTts = Boolean(savedTtsText && savedTtsText !== savedText);
  const effectiveTtsText = customTts ? (ttsText.trim() || text.trim()) : text.trim();
  const dirty = text !== savedText || effectiveTtsText !== savedTtsText;

  if (!editing) {
    return (
      <div className="mt-2">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 leading-6 text-slate-800 dark:text-slate-100">{savedText}</p>
          <button
            type="button"
            onClick={() => {
              setText(savedText);
              setTtsText(savedTtsText);
              setCustomTts(hasCustomTts);
              setEditing(true);
            }}
            className="shrink-0 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-indigo-800 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
          >
            編集
          </button>
        </div>
        {hasCustomTts && (
          <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">TTS個別指定: {savedTtsText}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-indigo-100 bg-white p-3 dark:border-indigo-950 dark:bg-slate-900">
      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">会話テキスト</label>
      <textarea
        value={text}
        onChange={(event) => {
          const nextText = event.target.value;
          setText(nextText);
          if (!customTts) setTtsText(nextText);
        }}
        rows={2}
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-800 dark:focus:ring-indigo-950"
      />
      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
        <button
          type="button"
          onClick={() => {
            const nextCustom = !customTts;
            setCustomTts(nextCustom);
            setTtsText(nextCustom ? (ttsText || text) : text);
          }}
          className="text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-300"
        >
          {customTts ? 'TTS個別指定を使わない' : 'TTSを個別指定する'}
        </button>
        {!customTts && (
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">TTSは会話テキストと同じ内容で保存されます。</p>
        )}
        {customTts && (
          <div className="mt-2">
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">TTSテキスト</label>
            <textarea
              value={ttsText}
              onChange={(event) => setTtsText(event.target.value)}
              rows={2}
              placeholder="読み・間・記号だけ変えたい時に入力"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-800 dark:focus:ring-indigo-950"
            />
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving || !text.trim() || !dirty}
          onClick={() => onSave(line, text.trim(), effectiveTtsText)}
          className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-200"
        >
          {saving ? '保存中...' : '保存'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setText(savedText);
            setTtsText(savedTtsText);
            setCustomTts(hasCustomTts);
            setEditing(false);
          }}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}

function LinkedAssetCount({ icon, count }: { icon: ReactNode; count: number }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 dark:bg-slate-900">{icon}{count}</span>;
}

function LineAssetBundle({
  line,
  assets,
  allAssets,
  allLines,
  savingLinkAssetId,
  savingPrimaryAssetId,
  subtitleClips = [],
  savingSubtitleClipId = '',
  renderingSubtitleAssetId = '',
  onRelinkAsset,
  onSetPrimaryAsset,
  onSaveSubtitleClip,
  onRenderSubtitledVideo,
}: {
  line: AnyRow;
  assets: AnyRow[];
  allAssets: AnyRow[];
  allLines: AnyRow[];
  savingLinkAssetId: string;
  savingPrimaryAssetId: string;
  subtitleClips?: AnyRow[];
  savingSubtitleClipId?: string;
  renderingSubtitleAssetId?: string;
  onRelinkAsset: (asset: AnyRow, nextLineId: string) => void;
  onSetPrimaryAsset: (asset: AnyRow) => void;
  onSaveSubtitleClip?: (clip: AnyRow, nextText: string, nextEnabled: boolean) => void;
  onRenderSubtitledVideo?: (asset: AnyRow) => void;
}) {
  const imageAssets = assets.filter((asset) => isVisualAsset(asset));
  const audioAssets = assets.filter((asset) => asset.asset_type === 'audio');
  const videoAssets = assets.filter((asset) => isVideoAsset(asset));
  const linkedAssetIds = new Set(assets.map((asset) => String(asset.id)));
  const candidateAssets = allAssets.filter((asset) => !linkedAssetIds.has(String(asset.id)));

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
          <Link2 size={14} />
          このセリフの素材セット
        </div>
        <AttachAssetSelect
          line={line}
          assets={candidateAssets}
          savingLinkAssetId={savingLinkAssetId}
          onRelinkAsset={onRelinkAsset}
        />
      </div>
      {assets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          まだ素材が紐付いていません。右上の「素材を追加」から、このセリフに画像・音声・動画を紐付けできます。
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          <LineAssetColumn title="画像" icon={<ImageIcon size={14} />} assets={imageAssets} empty="画像なし" allLines={allLines} savingLinkAssetId={savingLinkAssetId} savingPrimaryAssetId={savingPrimaryAssetId} onRelinkAsset={onRelinkAsset} onSetPrimaryAsset={onSetPrimaryAsset} />
          <LineAssetColumn title="音声" icon={<Mic2 size={14} />} assets={audioAssets} empty="音声なし" allLines={allLines} savingLinkAssetId={savingLinkAssetId} savingPrimaryAssetId={savingPrimaryAssetId} onRelinkAsset={onRelinkAsset} onSetPrimaryAsset={onSetPrimaryAsset} />
          <LineAssetColumn title="リップシンク/動画" icon={<Film size={14} />} assets={videoAssets} empty="動画なし" allLines={allLines} savingLinkAssetId={savingLinkAssetId} savingPrimaryAssetId={savingPrimaryAssetId} subtitleClips={subtitleClips} savingSubtitleClipId={savingSubtitleClipId} renderingSubtitleAssetId={renderingSubtitleAssetId} onRelinkAsset={onRelinkAsset} onSetPrimaryAsset={onSetPrimaryAsset} onSaveSubtitleClip={onSaveSubtitleClip} onRenderSubtitledVideo={onRenderSubtitledVideo} />
        </div>
      )}
    </div>
  );
}

function LineAssetColumn({
  title,
  icon,
  assets,
  empty,
  allLines,
  savingLinkAssetId,
  savingPrimaryAssetId,
  subtitleClips = [],
  savingSubtitleClipId = '',
  renderingSubtitleAssetId = '',
  onRelinkAsset,
  onSetPrimaryAsset,
  onSaveSubtitleClip,
  onRenderSubtitledVideo,
}: {
  title: string;
  icon: ReactNode;
  assets: AnyRow[];
  empty: string;
  allLines: AnyRow[];
  savingLinkAssetId: string;
  savingPrimaryAssetId: string;
  subtitleClips?: AnyRow[];
  savingSubtitleClipId?: string;
  renderingSubtitleAssetId?: string;
  onRelinkAsset: (asset: AnyRow, nextLineId: string) => void;
  onSetPrimaryAsset: (asset: AnyRow) => void;
  onSaveSubtitleClip?: (clip: AnyRow, nextText: string, nextEnabled: boolean) => void;
  onRenderSubtitledVideo?: (asset: AnyRow) => void;
}) {
  const [showNonPrimary, setShowNonPrimary] = useState(false);
  const primaryAssets = assets.filter((asset) => Boolean(asset.is_primary));
  const nonPrimaryAssets = assets.filter((asset) => !asset.is_primary);
  const visibleAssets = [...primaryAssets, ...(showNonPrimary ? nonPrimaryAssets : [])];

  return (
    <div className="min-w-0 rounded-xl bg-slate-50 p-2 dark:bg-slate-950">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
          {icon}{title}<Badge>{assets.length}</Badge>
        </div>
        {nonPrimaryAssets.length > 0 && (
          <button
            type="button"
            onClick={() => setShowNonPrimary((value) => !value)}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-800 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
          >
            {showNonPrimary ? <EyeOff size={12} /> : <Eye size={12} />}
            {showNonPrimary ? `候補を隠す (${nonPrimaryAssets.length})` : `候補を表示 (${nonPrimaryAssets.length})`}
          </button>
        )}
      </div>
      {assets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400 dark:border-slate-800">{empty}</p>
      ) : visibleAssets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400 dark:border-slate-800">
          primaryなし。候補を見るには「候補を表示」を押してください。
        </p>
      ) : (
        <div className="space-y-2">
          {visibleAssets.map((asset) => (
            <LinkedAssetCard
              key={String(asset.id)}
              asset={asset}
              allLines={allLines}
              saving={savingLinkAssetId === String(asset.id)}
              primarySaving={savingPrimaryAssetId === String(asset.id)}
              onRelinkAsset={onRelinkAsset}
              onSetPrimaryAsset={onSetPrimaryAsset}
              subtitleClips={subtitleClips}
              savingSubtitleClipId={savingSubtitleClipId}
              renderingSubtitleAssetId={renderingSubtitleAssetId}
              onSaveSubtitleClip={onSaveSubtitleClip}
              onRenderSubtitledVideo={onRenderSubtitledVideo}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LinkedAssetCard({
  asset,
  allLines,
  saving,
  primarySaving,
  subtitleClips = [],
  savingSubtitleClipId = '',
  renderingSubtitleAssetId = '',
  onRelinkAsset,
  onSetPrimaryAsset,
  onSaveSubtitleClip,
  onRenderSubtitledVideo,
}: {
  asset: AnyRow;
  allLines: AnyRow[];
  saving: boolean;
  primarySaving: boolean;
  subtitleClips?: AnyRow[];
  savingSubtitleClipId?: string;
  renderingSubtitleAssetId?: string;
  onRelinkAsset: (asset: AnyRow, nextLineId: string) => void;
  onSetPrimaryAsset: (asset: AnyRow) => void;
  onSaveSubtitleClip?: (clip: AnyRow, nextText: string, nextEnabled: boolean) => void;
  onRenderSubtitledVideo?: (asset: AnyRow) => void;
}) {
  const src = assetUrl(asset);
  const assetSubtitleClips = subtitleClipsForAsset(asset, subtitleClips);
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-slate-800 dark:bg-slate-900">
      {isVisualAsset(asset) && src && (
        <a href={src} target="_blank" rel="noreferrer" className="mb-2 flex max-h-72 items-center justify-center overflow-hidden rounded-md bg-slate-100 dark:bg-slate-950">
          <img src={src} alt={`asset ${String(asset.id)}`} className="h-auto max-h-72 w-full object-contain" loading="lazy" />
        </a>
      )}
      {isVideoAsset(asset) && src && <VideoPlayer asset={asset} subtitleClips={assetSubtitleClips} compact />}
      {asset.asset_type === 'audio' && <AudioPlayer asset={asset} compact />}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-slate-700 dark:text-slate-200">asset #{asset.id}</span>
        {asset.is_primary && <Badge>primary</Badge>}
      </div>
      <DialoguePrimaryControl
        asset={asset}
        saving={primarySaving}
        onSetPrimary={() => onSetPrimaryAsset(asset)}
      />
      {isVideoAsset(asset) && (
        <SubtitleVideoControls
          asset={asset}
          subtitleClips={assetSubtitleClips}
          savingSubtitleClipId={savingSubtitleClipId}
          rendering={renderingSubtitleAssetId === String(asset.id)}
          onSaveSubtitleClip={onSaveSubtitleClip}
          onRenderSubtitledVideo={onRenderSubtitledVideo}
        />
      )}
      <AssetLineLinkControl asset={asset} allLines={allLines} saving={saving} compact onChange={(nextLineId) => onRelinkAsset(asset, nextLineId)} />
      {canRemakeCheckAsset(asset) && <RemakeCheckControl asset={asset} />}
    </div>
  );
}

function DialoguePrimaryControl({
  asset,
  saving,
  onSetPrimary,
}: {
  asset: AnyRow;
  saving: boolean;
  onSetPrimary: () => void;
}) {
  const lineLinked = asset.script_line_id != null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {asset.is_primary ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          <Check size={12} /> この種別のprimary
        </span>
      ) : (
        <button
          type="button"
          disabled={saving || !lineLinked}
          onClick={onSetPrimary}
          className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-200"
          title="同じセリフ・同じ素材種別のprimaryをこの素材に変更"
        >
          <Check size={12} /> {saving ? 'primary変更中...' : 'primaryにする'}
        </button>
      )}
      {!lineLinked && <span className="text-[11px] text-slate-400">セリフ未紐付け</span>}
    </div>
  );
}

function AttachAssetSelect({
  line,
  assets,
  savingLinkAssetId,
  onRelinkAsset,
}: {
  line: AnyRow;
  assets: AnyRow[];
  savingLinkAssetId: string;
  onRelinkAsset: (asset: AnyRow, nextLineId: string) => void;
}) {
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const selected = assets.find((asset) => String(asset.id) === selectedAssetId);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <select
        value={selectedAssetId}
        onChange={(event) => setSelectedAssetId(event.target.value)}
        className="max-w-[220px] rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        title="未紐付け/別行の素材をこのセリフへ移動"
      >
        <option value="">素材を追加</option>
        {assets.map((asset) => (
          <option key={String(asset.id)} value={String(asset.id)}>
            {assetKindLabel(asset)} #{asset.id}{asset.line_index ? ` / 現在 line ${asset.line_index}` : ' / 未紐付け'}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!selected || Boolean(selected && savingLinkAssetId === String(selected.id))}
        onClick={() => {
          if (!selected) return;
          onRelinkAsset(selected, String(line.id));
          setSelectedAssetId('');
        }}
        className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-200"
      >
        <Link2 size={12} />
        紐付け
      </button>
    </div>
  );
}

function AssetLineLinkControl({
  asset,
  allLines,
  saving,
  compact = false,
  onChange,
}: {
  asset: AnyRow;
  allLines: AnyRow[];
  saving: boolean;
  compact?: boolean;
  onChange: (nextLineId: string) => void;
}) {
  const currentLineId = asset.script_line_id == null ? '' : String(asset.script_line_id);
  return (
    <div className={compact ? 'mt-2 flex flex-wrap items-center gap-2' : 'mt-3 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 dark:border-indigo-950 dark:bg-indigo-950/30'}>
      {!compact && (
        <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-indigo-700 dark:text-indigo-200">
          <Link2 size={13} /> セリフへの紐付け
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={currentLineId}
          disabled={saving}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-[180px] rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          title="この素材をどのセリフに紐付けるか選択"
        >
          <option value="">未紐付け</option>
          {allLines.map((line) => (
            <option key={String(line.id)} value={String(line.id)}>
              line {line.line_index} {line.speaker_name ? `/${line.speaker_name}` : ''}: {String(line.text || '').slice(0, 24)}
            </option>
          ))}
        </select>
        {currentLineId && (
          <button
            type="button"
            disabled={saving}
            onClick={() => onChange('')}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <Unlink size={12} /> 外す
          </button>
        )}
        {saving && <span className="text-[11px] text-indigo-600 dark:text-indigo-300">保存中...</span>}
      </div>
    </div>
  );
}


function SceneImageDisplayControl({
  asset,
  enabledSceneImageAssets,
  saving,
  onToggle,
  onMove,
}: {
  asset: AnyRow;
  enabledSceneImageAssets: AnyRow[];
  saving: boolean;
  onToggle: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const enabledIndex = enabledSceneImageAssets.findIndex((item) => String(item.id) === String(asset.id));
  const enabled = enabledIndex >= 0;
  const order = getSceneImageOrder(asset) || (enabled ? enabledIndex + 1 : 0);
  const canMoveUp = enabled && enabledIndex > 0;
  const canMoveDown = enabled && enabledIndex >= 0 && enabledIndex < enabledSceneImageAssets.length - 1;

  return (
    <div className={`mt-3 rounded-lg border px-3 py-2 ${enabled ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40' : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          disabled={saving}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium transition disabled:opacity-60 ${enabled ? 'border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-slate-950 dark:text-emerald-300' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}
          title="この画像をシーンページで使うか切り替え"
        >
          {enabled ? <Eye size={13} /> : <EyeOff size={13} />}
          {saving ? '保存中...' : enabled ? 'シーンで使う' : '使わない'}
        </button>
        <div className="flex items-center gap-1">
          {enabled && <span className="mr-1 rounded-full bg-white px-2 py-1 text-[11px] font-medium text-emerald-700 dark:bg-slate-950 dark:text-emerald-300">順番 {order || enabledIndex + 1}</span>}
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={!canMoveUp || saving}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-indigo-800 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
            title="使用画像の順番を上へ"
          >
            <ArrowUp size={13} />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={!canMoveDown || saving}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-indigo-800 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
            title="使用画像の順番を下へ"
          >
            <ArrowDown size={13} />
          </button>
        </div>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
        {enabled ? '通常表示ではこの順番で並びます。' : '通常表示から外れます。履歴表示をONにすると再度選べます。'}
      </p>
    </div>
  );
}

function SubtitleTools({
  subtitleClips,
  sourceVideoCount,
  saving,
  renderingFinal,
  error,
  onSync,
  onRenderFinal,
}: {
  subtitleClips: AnyRow[];
  sourceVideoCount: number;
  saving: boolean;
  renderingFinal: boolean;
  error: string;
  onSync: () => void;
  onRenderFinal: () => void;
}) {
  const enabledCount = subtitleClips.filter((clip) => subtitleMetadata(clip).enabled !== false && subtitleText(clip)).length;
  return (
    <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs dark:border-indigo-950 dark:bg-indigo-950/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-indigo-800 dark:text-indigo-200">
          <Subtitles size={15} />
          <span className="font-semibold">字幕プレビュー / 焼き込み</span>
          <Badge>{enabledCount}/{subtitleClips.length} clips</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRenderFinal}
            disabled={renderingFinal || sourceVideoCount === 0 || enabledCount === 0}
            className="rounded-full border border-indigo-200 bg-indigo-600 px-3 py-1 font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            title="セリフ順に動画をつなげて、現在の字幕スタイルで焼き込みます"
          >
            {renderingFinal ? '結合書き出し中...' : `動画結合＋字幕焼き込み (${sourceVideoCount}本)`}
          </button>
          <button
            type="button"
            onClick={onSync}
            disabled={saving}
            className="rounded-full border border-indigo-200 bg-white px-3 py-1 font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-900 dark:bg-slate-950 dark:text-indigo-200 dark:hover:bg-indigo-950"
          >
            {saving ? '字幕作成中...' : subtitleClips.length ? '台本から字幕を再同期' : '台本から字幕を作成'}
          </button>
        </div>
      </div>
      <p className="mt-2 leading-5 text-slate-600 dark:text-slate-300">
        text timeline clip を字幕として使います。単体動画の焼き込みに加えて、セリフ順の動画を1本につなげてから同じ字幕スタイルで final_video を書き出せます。
      </p>
      {error && <p className="mt-2 text-red-600 dark:text-red-300">{error}</p>}
    </div>
  );
}

function SubtitleVideoControls({
  asset,
  subtitleClips,
  savingSubtitleClipId,
  rendering,
  onSaveSubtitleClip,
  onRenderSubtitledVideo,
}: {
  asset: AnyRow;
  subtitleClips: AnyRow[];
  savingSubtitleClipId: string;
  rendering: boolean;
  onSaveSubtitleClip?: (clip: AnyRow, nextText: string, nextEnabled: boolean) => void;
  onRenderSubtitledVideo?: (asset: AnyRow) => void;
}) {
  return (
    <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 dark:border-indigo-950 dark:bg-indigo-950/30">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-medium text-indigo-700 dark:text-indigo-200">
          <Subtitles size={13} /> 字幕
        </div>
        <button
          type="button"
          disabled={rendering || subtitleClips.length === 0 || !onRenderSubtitledVideo}
          onClick={() => onRenderSubtitledVideo?.(asset)}
          className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-900 dark:bg-slate-950 dark:text-indigo-200"
          title="現在の字幕を焼き込んだ新しいMP4を生成"
        >
          {rendering ? '書き出し中...' : '字幕焼き込みMP4を書き出し'}
        </button>
      </div>
      {subtitleClips.length === 0 ? (
        <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">まだ字幕clipがありません。タイムライン欄の「台本から字幕を作成」を押してね。</p>
      ) : (
        <div className="space-y-2">
          {subtitleClips.map((clip) => (
            <SubtitleClipEditor
              key={String(clip.id)}
              clip={clip}
              saving={savingSubtitleClipId === String(clip.id)}
              onSave={onSaveSubtitleClip}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SubtitleClipEditor({ clip, saving, onSave }: { clip: AnyRow; saving: boolean; onSave?: (clip: AnyRow, nextText: string, nextEnabled: boolean) => void }) {
  const metadata = subtitleMetadata(clip);
  const [text, setText] = useState(subtitleText(clip));
  const [enabled, setEnabled] = useState(metadata.enabled !== false);
  const savedText = subtitleText(clip);
  const savedEnabled = metadata.enabled !== false;
  const dirty = text !== savedText || enabled !== savedEnabled;


  return (
    <div className="rounded-lg bg-white p-2 dark:bg-slate-950">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <span>clip #{clip.id} / {formatMs(clipLocalStartMs(clip))} → {formatMs(clipLocalEndMs(clip))}</span>
        <label className="inline-flex items-center gap-1">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          表示
        </label>
      </div>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={2}
        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] leading-5 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-800 dark:focus:ring-indigo-950"
      />
      <button
        type="button"
        disabled={!dirty || saving || !onSave}
        onClick={() => onSave?.(clip, text, enabled)}
        className="mt-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-200"
      >
        {saving ? '保存中...' : '字幕を保存'}
      </button>
    </div>
  );
}

function renderSubtitleTextWithBreaks(text: string): ReactNode[] {
  const chars = Array.from(text);
  const nodes: ReactNode[] = [];
  chars.forEach((char, index) => {
    nodes.push(char);
    if ('、。！？!?'.includes(char) && index < chars.length - 1) {
      nodes.push(<br key={`subtitle-break-${index}`} />);
    }
  });
  return nodes;
}

function VideoPlayer({ asset, subtitleClips = [], compact = false }: { asset: AnyRow; subtitleClips?: AnyRow[]; compact?: boolean }) {
  const src = assetUrl(asset);
  const downloadSrc = storageDownloadUrl(src);
  const [currentMs, setCurrentMs] = useState(0);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const activeSubtitle = activeSubtitleAt(subtitleClips, currentMs);
  const text = showSubtitles && activeSubtitle ? subtitleText(activeSubtitle) : '';
  const hasSubtitles = subtitleClips.some((clip) => subtitleMetadata(clip).enabled !== false && subtitleText(clip).trim());
  const showInlineSubtitle = Boolean(text && !compact);

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded]);

  const handleLoadedMetadata = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    if (video.videoWidth && video.videoHeight) {
      setNaturalSize({ width: video.videoWidth, height: video.videoHeight });
    }
  };

  if (!src) return null;
  return (
    <div className={compact ? 'mb-2 min-w-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-950' : 'mb-3 min-w-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-950'}>
      <div className="relative">
        <video
          controls
          preload="metadata"
          src={src}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={(event) => setCurrentMs(Math.round(event.currentTarget.currentTime * 1000))}
          className={compact ? 'max-h-44 w-full bg-black' : 'max-h-[420px] w-full max-w-full bg-black'}
        />
        <div className="absolute left-2 top-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white shadow backdrop-blur transition hover:bg-black/75"
            title="実サイズに近い表示で確認"
          >
            拡大
          </button>
          <a
            href={downloadSrc}
            className="rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white shadow backdrop-blur transition hover:bg-black/75"
            title="動画をダウンロード"
          >
            DL
          </a>
        </div>
        {hasSubtitles && (
          <button
            type="button"
            onClick={() => setShowSubtitles((value) => !value)}
            className="absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white shadow backdrop-blur transition hover:bg-black/75"
            title={showSubtitles ? '字幕を非表示' : '字幕を表示'}
          >
            字幕 {showSubtitles ? 'ON' : 'OFF'}
          </button>
        )}
        {showInlineSubtitle && (
          <div className="pointer-events-none absolute inset-x-3 bottom-8 flex justify-center text-center">
            <span className="subtitle-preview-text max-w-[92%] rounded-lg bg-black/60 px-3 py-1.5 text-sm font-semibold leading-relaxed text-white shadow sm:text-base">
              {renderSubtitleTextWithBreaks(text)}
            </span>
          </div>
        )}
        {compact && hasSubtitles && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center text-center">
            <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white shadow">字幕は拡大で表示</span>
          </div>
        )}
      </div>
      {expanded && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setExpanded(false)}
        >
          <div className="w-full max-w-[calc(100vw-2rem)]" style={{ maxWidth: naturalSize?.width ? `${naturalSize.width}px` : undefined }} onClick={(event) => event.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-3 text-white">
              <div className="min-w-0 text-xs text-white/75">
                asset #{String(asset.id)}{naturalSize ? ` · ${naturalSize.width}×${naturalSize.height}` : ''}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a href={downloadSrc} className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold transition hover:bg-white/25">
                  DL
                </a>
                <button type="button" onClick={() => setExpanded(false)} className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold transition hover:bg-white/25">
                  閉じる
                </button>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-lg bg-black shadow-2xl">
              <video
                controls
                autoPlay
                preload="metadata"
                src={src}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={(event) => setCurrentMs(Math.round(event.currentTarget.currentTime * 1000))}
                className="max-h-[calc(100vh-7rem)] w-full bg-black object-contain"
                style={{ maxHeight: naturalSize?.height ? `min(${naturalSize.height}px, calc(100vh - 7rem))` : undefined }}
              />
              {text && (
                <div className="pointer-events-none absolute inset-x-5 bottom-[12%] flex justify-center text-center">
                  <span className="subtitle-preview-text max-w-[92%] px-4 py-2 text-base font-semibold leading-relaxed text-white sm:text-lg">
                    {renderSubtitleTextWithBreaks(text)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RemakeCheckControl({ asset }: { asset: AnyRow }) {
  const metadata: Record<string, unknown> = isRecord(asset.metadata) ? asset.metadata : {};
  const initialNote = remakeCheckNoteFromMetadata(metadata);
  const [checked, setChecked] = useState(Boolean(metadata.remake_check));
  const [note, setNote] = useState(initialNote);
  const [savedNote, setSavedNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const assetId = String(asset.id ?? '');
  const noteDirty = note.trim() !== savedNote.trim();
  const isVideo = isVideoAsset(asset);
  const targetLabel = isVideo ? 'リップシンク動画' : asset.asset_type === 'audio' ? '音声' : '画像';
  const noteLabel = `${targetLabel}の修正指示`;
  const placeholder = isVideo
    ? '例: 口の動きが遅い、しゃべるキャラが違う、表情をもっと焦らせる、頭が揺れすぎる'
    : asset.asset_type === 'audio'
      ? '例: もっと可愛く、語尾を上げる、早口すぎるので少し落ち着かせる'
      : '例: みりあの髪留めを正しく、背景の人物を消す、表情をもっと焦らせる';

  useEffect(() => {
    const nextNote = remakeCheckNoteFromMetadata(metadata);
    setChecked(Boolean(metadata.remake_check));
    setNote(nextNote);
    setSavedNote(nextNote);
  }, [asset.id, metadata]);

  const save = async (nextChecked = checked) => {
    if (!assetId || saving) return;
    const previousChecked = checked;
    setChecked(nextChecked);
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/agent-assets/${assetId}/remake-check`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked: nextChecked, note }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '保存に失敗しました');
      }
      setSavedNote(note.trim());
    } catch (err) {
      setChecked(previousChecked);
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/40">
      <button
        type="button"
        onClick={() => save(!checked)}
        disabled={saving}
        className="flex w-full items-center justify-between gap-3 text-left text-[12px] font-medium text-amber-800 disabled:opacity-60 dark:text-amber-200"
        title="エージェントが作り直し対象として検索できます"
      >
        <span className="flex items-center gap-2">
          <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? 'border-amber-600 bg-amber-500 text-white' : 'border-amber-300 bg-white dark:border-amber-800 dark:bg-slate-950'}`}>
            {checked && <Check size={12} />}
          </span>
          {targetLabel} 作り直しチェック
        </span>
        <span className="text-[11px] text-amber-600 dark:text-amber-300">{saving ? '保存中...' : checked ? 'ON' : 'OFF'}</span>
      </button>
      <label className="mt-2 block text-[11px] font-medium text-amber-800 dark:text-amber-200">{noteLabel}</label>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={2}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-[12px] leading-5 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-100 dark:border-amber-900 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-amber-950"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => save(checked || Boolean(note.trim()))}
          disabled={saving || (!noteDirty && checked) || (!checked && !note.trim())}
          className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[11px] font-medium text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800 dark:bg-slate-950 dark:text-amber-200 dark:hover:bg-amber-950"
        >
          {checked ? '修正指示を保存' : '修正指示を保存してON'}
        </button>
        {checked && <span className="text-[11px] text-amber-700 dark:text-amber-300">エージェントが{targetLabel}の再生成対象として拾えます。</span>}
      </div>
      {error && <p className="mt-1 text-[11px] text-red-600 dark:text-red-300">{error}</p>}
    </div>
  );
}

function TimelineClipRow({ clip }: { clip: AnyRow }) {
  const src = assetUrl({ url: clip.asset_url, storage_path: clip.asset_storage_path });
  return (
    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-950">
      <div className="flex flex-wrap items-center gap-2 text-slate-500 dark:text-slate-400">
        <span>clip #{clip.id}</span>
        {clip.asset_id != null && <span>asset #{clip.asset_id}</span>}
        <span>{formatMs(clip.start_time_ms)} → {formatMs(clip.end_time_ms)}</span>
        {clip.asset_duration_seconds != null && <span>source {Number(clip.asset_duration_seconds).toFixed(1)}s</span>}
      </div>
      {src && (
        <a href={src} target="_blank" rel="noreferrer" className="mt-1 block truncate text-indigo-600 hover:underline dark:text-indigo-300">
          {String(clip.asset_storage_path || clip.asset_url || src)}
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
          <div className="flex shrink-0 items-center gap-1">
            <DownloadAudioButton asset={asset} src={src} />
            <CopyAssetIdButton assetId={asset.id} />
          </div>
        </div>
      )}
      <audio controls preload="none" src={src} className="h-9 w-full max-w-full" />
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
        {!compact && <DownloadAudioButton asset={asset} src={src} />}
        <a href={src} target="_blank" rel="noreferrer" className="min-w-0 truncate text-[11px] text-indigo-600 hover:underline dark:text-indigo-300">
          {String(asset.storage_path || asset.url || src)}
        </a>
      </div>
    </div>
  );
}

function DownloadAudioButton({ asset, src }: { asset: AnyRow; src: string }) {
  return (
    <a
      href={src}
      download={audioDownloadName(asset)}
      title="音声ファイルをダウンロード"
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-indigo-800 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
    >
      <Download size={12} />
      download
    </a>
  );
}

function audioDownloadName(asset: AnyRow) {
  const path = String(asset.storage_path || asset.url || '');
  const basename = path.split('/').pop()?.split('?')[0] || '';
  if (basename) return basename;
  const ext = String(asset.mime_type || '').includes('mpeg') ? 'mp3' : String(asset.mime_type || '').includes('wav') ? 'wav' : 'audio';
  return `asset-${String(asset.id || 'audio')}.${ext}`;
}


function CopyAssetIdButton({ assetId }: { assetId: ReactNode }) {
  const value = String(assetId ?? '');
  return <CopyPrefixedIdButton label="asset_id" value={value} idleText="copy asset_id" title="asset_id: 形式でコピー" />;
}

function CopyDialogueIdButton({ dialogueId }: { dialogueId: ReactNode }) {
  const value = String(dialogueId ?? '');
  return <CopyPrefixedIdButton label="dialogue_id" value={value} idleText={`dialogue_id: ${value}`} title="dialogue_id: 形式でコピー" />;
}

function CopyPrefixedIdButton({ label, value, idleText, title }: { label: string; value: string; idleText: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const copyValue = value ? `${label}: ${value}` : '';

  const copy = async () => {
    if (!copyValue) return;
    await navigator.clipboard.writeText(copyValue);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!copyValue}
      title={title}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:border-indigo-800 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'copied' : idleText}
    </button>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function remakeCheckNoteFromMetadata(metadata: Record<string, unknown>) {
  for (const key of ['remake_check_note', 'remake_instruction_note', 'remake_reason']) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function assetUrl(asset: AnyRow) {
  const metadata = assetMetadata(asset);
  const publicPreviewUrl = typeof metadata.public_preview_url === 'string' ? metadata.public_preview_url : '';
  const raw = isVideoAsset(asset) && publicPreviewUrl
    ? publicPreviewUrl
    : typeof asset.url === 'string' && asset.url ? asset.url : typeof asset.storage_path === 'string' ? asset.storage_path : '';

  return storageUrl(raw);
}

function storageDownloadUrl(url: string) {
  if (!url) return '';
  try {
    const parsed = new URL(url, typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
    parsed.searchParams.set('download', '1');
    return parsed.pathname.startsWith('/api/storage/') ? `${parsed.pathname}${parsed.search}` : url;
  } catch {
    return url;
  }
}

function storageUrl(raw: string) {
  if (!raw) return '';

  let clean = raw.trim();

  try {
    const parsed = new URL(clean);
    if (parsed.hostname === 'storage.googleapis.com') {
      const parts = parsed.pathname.split('/').filter(Boolean);
      // Route GCS object URLs through the authenticated storage API. The server
      // resolves the object from GCP_STORAGE_BUCKET.
      if (parts.length > 1) {
        clean = parts.slice(1).join('/');
      } else {
        return clean;
      }
    } else {
      return clean;
    }
  } catch {
    // Not a URL; treat it as a storage object path below.
  }

  if (clean.startsWith('/api/storage/')) return clean;
  clean = clean.replace(/^\/+/, '').replace(/^api\/storage\//, '');
  return `/api/storage/${clean.split('/').map(encodeURIComponent).join('/')}`;
}

function formatMs(value: ReactNode) {
  const ms = Number(value ?? 0);
  if (!Number.isFinite(ms)) return '0.00s';
  return `${(ms / 1000).toFixed(2)}s`;
}

function assetIcon(type: string) {
  if (type.includes('audio')) return <Mic2 size={16} />;
  if (type.includes('video')) return <Film size={16} />;
  if (type.includes('image') || type.includes('thumbnail') || type.includes('layout') || type.includes('diagram')) return <ImageIcon size={16} />;
  return <Layers size={16} />;
}
