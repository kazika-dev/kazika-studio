'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import MovieIcon from '@mui/icons-material/Movie';
import ImageIcon from '@mui/icons-material/Image';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Toaster } from 'sonner';

type SceneAsset = {
  id: number;
  scene_id: number;
  output_id: number | null;
  asset_type: 'image' | 'video' | 'dialogue' | 'bgm' | 'sfx' | 'audio' | 'file' | 'other';
  status: 'candidate' | 'selected' | 'rejected' | 'archived';
  content_url: string;
  signed_url?: string;
  title: string | null;
  prompt: string | null;
  rank: number;
  is_primary: boolean;
  metadata: Record<string, unknown>;
};

type TimelineClip = {
  id: number;
  scene_id: number;
  track_id: number;
  scene_asset_id: number | null;
  output_id: number | null;
  clip_type: string;
  title: string | null;
  start_time: string | number;
  duration: string | number;
  volume: string | number;
  opacity: string | number;
  asset?: SceneAsset | null;
};

type TimelineTrack = {
  id: number;
  track_type: 'visual' | 'dialogue' | 'bgm' | 'sfx' | 'overlay' | 'text' | 'other';
  name: string;
  sort_order: number;
  muted: boolean;
  locked: boolean;
  visible: boolean;
  clips: TimelineClip[];
};

type TimelineResponse = {
  success: boolean;
  error?: string;
  scene?: { id: number; name: string; description?: string | null };
  assets?: SceneAsset[];
  timeline?: { tracks: TimelineTrack[] };
};

const TRACK_LABELS: Record<string, string> = {
  visual: '映像', dialogue: 'セリフ', bgm: 'BGM', sfx: '効果音', overlay: '重ね素材', text: 'テキスト', other: 'その他',
};
const ASSET_LABELS: Record<string, string> = {
  image: '画像', video: '動画', dialogue: 'セリフ', bgm: 'BGM', sfx: 'SE', audio: '音声', file: 'ファイル', other: 'その他',
};

function assetIcon(type: string) {
  if (type === 'image') return <ImageIcon fontSize="small" />;
  if (type === 'video') return <MovieIcon fontSize="small" />;
  if (type === 'bgm') return <MusicNoteIcon fontSize="small" />;
  if (type === 'sfx') return <GraphicEqIcon fontSize="small" />;
  return <AudiotrackIcon fontSize="small" />;
}

function preferredTrackType(assetType: SceneAsset['asset_type']): TimelineTrack['track_type'] {
  if (assetType === 'image' || assetType === 'video') return 'visual';
  if (assetType === 'bgm') return 'bgm';
  if (assetType === 'sfx') return 'sfx';
  if (assetType === 'dialogue' || assetType === 'audio') return 'dialogue';
  return 'overlay';
}

function defaultDuration(asset: SceneAsset) {
  const rawDuration = asset.metadata?.duration_seconds;
  if (typeof rawDuration === 'number' && rawDuration > 0) return rawDuration;
  if (typeof rawDuration === 'string') {
    const parsed = parseFloat(rawDuration);
    if (parsed > 0) return parsed;
  }
  if (asset.asset_type === 'sfx') return 1;
  if (asset.asset_type === 'bgm') return 10;
  return 5;
}

function asNumber(value: string | number | null | undefined, fallback = 0) {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function MobileSceneTimelineEditor({ sceneId }: { sceneId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sceneName, setSceneName] = useState('');
  const [assets, setAssets] = useState<SceneAsset[]>([]);
  const [tracks, setTracks] = useState<TimelineTrack[]>([]);
  const [tab, setTab] = useState(0);
  const [editingClip, setEditingClip] = useState<TimelineClip | null>(null);
  const [editStart, setEditStart] = useState('0');
  const [editDuration, setEditDuration] = useState('1');
  const [editVolume, setEditVolume] = useState('1');

  const clips = useMemo(() => tracks.flatMap((track) => track.clips.map((clip) => ({ ...clip, track }))), [tracks]);
  const totalDuration = useMemo(() => Math.max(clips.reduce((max, clip) => Math.max(max, asNumber(clip.start_time) + asNumber(clip.duration, 1)), 0), 1), [clips]);

  const loadTimeline = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/scene-masters/${sceneId}/timeline?ensure_defaults=true`);
      const data: TimelineResponse = await response.json();
      if (!data.success) {
        setError(data.error || 'タイムラインの読み込みに失敗しました');
        return;
      }
      setSceneName(data.scene?.name || `Scene ${sceneId}`);
      setAssets(data.assets || []);
      setTracks(data.timeline?.tracks || []);
    } catch (err) {
      console.error(err);
      setError('タイムラインの読み込み中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [sceneId]);

  useEffect(() => { loadTimeline(); }, [loadTimeline]);

  const addAssetToTimeline = async (asset: SceneAsset) => {
    const track = tracks.find((t) => t.track_type === preferredTrackType(asset.asset_type)) || tracks[0];
    if (!track) { toast.error('配置先トラックがありません'); return; }
    try {
      const response = await fetch(`/api/scene-masters/${sceneId}/timeline`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clip', track_id: track.id, scene_asset_id: asset.id, output_id: asset.output_id,
          clip_type: asset.asset_type, title: asset.title || ASSET_LABELS[asset.asset_type],
          start_time: totalDuration === 1 && clips.length === 0 ? 0 : totalDuration,
          duration: defaultDuration(asset), volume: asset.asset_type === 'bgm' ? 0.35 : 1,
          opacity: 1, metadata: { source: 'mobile_scene_timeline_editor' },
        }),
      });
      const data = await response.json();
      if (!data.success) { toast.error(data.error || 'クリップ追加に失敗しました'); return; }
      toast.success('タイムラインに追加しました');
      await loadTimeline();
      setTab(1);
    } catch (err) { console.error(err); toast.error('クリップ追加に失敗しました'); }
  };

  const openClipEditor = (clip: TimelineClip) => {
    setEditingClip(clip);
    setEditStart(String(asNumber(clip.start_time)));
    setEditDuration(String(asNumber(clip.duration, 1)));
    setEditVolume(String(asNumber(clip.volume, 1)));
  };

  const saveClip = async () => {
    if (!editingClip) return;
    try {
      const response = await fetch(`/api/scene-timeline/clips/${editingClip.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_time: parseFloat(editStart) || 0, duration: Math.max(0.1, parseFloat(editDuration) || 1), volume: Math.max(0, parseFloat(editVolume) || 0) }),
      });
      const data = await response.json();
      if (!data.success) { toast.error(data.error || '保存に失敗しました'); return; }
      toast.success('保存しました');
      setEditingClip(null);
      await loadTimeline();
    } catch (err) { console.error(err); toast.error('保存に失敗しました'); }
  };

  const deleteClip = async (clip: TimelineClip) => {
    try {
      const response = await fetch(`/api/scene-timeline/clips/${clip.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!data.success) { toast.error(data.error || '削除に失敗しました'); return; }
      toast.success('削除しました');
      await loadTimeline();
    } catch (err) { console.error(err); toast.error('削除に失敗しました'); }
  };

  if (loading) return <Container sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Container>;
  if (error) return <Container sx={{ py: 3 }}><Alert severity="error">{error}</Alert><Button startIcon={<ArrowBackIcon />} onClick={() => router.back()} sx={{ mt: 2 }}>戻る</Button></Container>;

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'grey.50', pb: 10 }}>
      <Toaster position="top-center" richColors />
      <Box sx={{ position: 'sticky', top: 0, zIndex: 10, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', px: 1.5, py: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton onClick={() => router.back()} size="small"><ArrowBackIcon /></IconButton>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={800} noWrap>{sceneName}</Typography>
            <Typography variant="caption" color="text.secondary">{clips.length} clips / {totalDuration.toFixed(1)}s</Typography>
          </Box>
          <Button size="small" variant="contained" disabled>Render</Button>
        </Stack>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="fullWidth" sx={{ mt: 1 }}>
          <Tab label="素材" /><Tab label="配置" /><Tab label="確認" />
        </Tabs>
      </Box>

      {tab === 0 && <Stack spacing={1.25} sx={{ p: 1.5 }}>
        {assets.length === 0 ? <Alert severity="info">このシーンの素材候補がまだありません</Alert> : assets.map((asset) => (
          <Card key={asset.id} variant="outlined" sx={{ borderRadius: 3 }}><CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Box sx={{ width: 76, height: 76, borderRadius: 2, bgcolor: 'grey.100', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {asset.asset_type === 'image' && asset.signed_url ? <Box component="img" src={asset.signed_url} alt={asset.title || 'asset'} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : assetIcon(asset.asset_type)}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" mb={0.5}><Chip icon={assetIcon(asset.asset_type)} label={ASSET_LABELS[asset.asset_type]} size="small" /><Chip label={asset.status} size="small" variant="outlined" color={asset.status === 'selected' ? 'success' : 'default'} /></Stack>
                <Typography variant="body2" fontWeight={700} noWrap>{asset.title || asset.content_url}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap component="div">{asset.content_url}</Typography>
              </Box>
              <IconButton color="primary" onClick={() => addAssetToTimeline(asset)}><AddIcon /></IconButton>
            </Stack>
          </CardContent></Card>
        ))}
      </Stack>}

      {tab === 1 && <Stack spacing={1.5} sx={{ p: 1.5 }}>
        {tracks.map((track) => <Card key={track.id} variant="outlined" sx={{ borderRadius: 3 }}><CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}><Typography variant="subtitle2" fontWeight={800}>{TRACK_LABELS[track.track_type] || track.name}</Typography><Chip size="small" label={`${track.clips.length} clips`} /></Stack>
          <Stack spacing={1}>{track.clips.length === 0 ? <Typography variant="caption" color="text.secondary">まだ配置なし</Typography> : track.clips.map((clip) => <Box key={clip.id} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.default' }}>
            <Stack direction="row" alignItems="center" spacing={1}><Box sx={{ flex: 1, minWidth: 0 }} onClick={() => openClipEditor(clip)}><Typography variant="body2" fontWeight={700} noWrap>{clip.title || clip.asset?.title || clip.clip_type}</Typography><Typography variant="caption" color="text.secondary">{asNumber(clip.start_time).toFixed(1)}s → {(asNumber(clip.start_time) + asNumber(clip.duration, 1)).toFixed(1)}s / vol {asNumber(clip.volume, 1).toFixed(2)}</Typography></Box><IconButton size="small" onClick={() => deleteClip(clip)} color="error"><DeleteIcon fontSize="small" /></IconButton></Stack>
          </Box>)}</Stack>
        </CardContent></Card>)}
      </Stack>}

      {tab === 2 && <Stack spacing={1.5} sx={{ p: 1.5 }}><Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent>
        <Typography variant="subtitle2" fontWeight={800} gutterBottom>簡易プレビュー</Typography>
        <Typography variant="body2" color="text.secondary">今は配置順と秒数確認まで。動画合成プレビューはFFmpegレンダー実装後に繋ぐ。</Typography>
        <Divider sx={{ my: 2 }} />
        <Stack spacing={1}>{[...clips].sort((a, b) => asNumber(a.start_time) - asNumber(b.start_time)).map((clip) => <Stack key={clip.id} direction="row" spacing={1} alignItems="center"><Chip label={`${asNumber(clip.start_time).toFixed(1)}s`} size="small" /><Typography variant="body2" noWrap>{clip.title || clip.asset?.title || clip.clip_type}</Typography></Stack>)}</Stack>
      </CardContent></Card></Stack>}

      <Dialog open={Boolean(editingClip)} onClose={() => setEditingClip(null)} fullWidth maxWidth="xs">
        <DialogTitle>クリップ編集</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField label="開始秒" type="number" value={editStart} onChange={(e) => setEditStart(e.target.value)} fullWidth /><TextField label="長さ（秒）" type="number" value={editDuration} onChange={(e) => setEditDuration(e.target.value)} fullWidth /><TextField label="音量" type="number" value={editVolume} onChange={(e) => setEditVolume(e.target.value)} fullWidth helperText="BGMは0.25〜0.45くらいが無難" /></Stack></DialogContent>
        <DialogActions><Button onClick={() => setEditingClip(null)}>キャンセル</Button><Button variant="contained" onClick={saveClip}>保存</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
