'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Link as MuiLink,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import type { ChipProps } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ImageIcon from '@mui/icons-material/Image';
import MovieIcon from '@mui/icons-material/Movie';
import HubIcon from '@mui/icons-material/Hub';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

interface OutputItem {
  id: number;
  output_type: 'image' | 'video' | string;
  content_url: string | null;
  content_text?: string | null;
  prompt?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string;
  derived_video_jobs?: number;
  derived_videos?: number;
  source_image_id?: number | null;
  source_image_url?: string | null;
  generation_job_id?: number | null;
  provider?: string | null;
  model?: string | null;
  job_status?: string | null;
}

interface GenerationJob {
  id: number;
  job_type: string;
  provider: string;
  model?: string | null;
  prompt?: string | null;
  status: string;
  external_job_url?: string | null;
  external_job_id?: string | null;
  credits_used?: string | null;
  latest_result_url?: string | null;
  input_count: number;
  result_count: number;
  created_at: string;
}

interface Studio {
  id: number;
  name: string;
  description?: string | null;
}

interface GenerationsResponse {
  success: boolean;
  studio: Studio;
  images: OutputItem[];
  videos: OutputItem[];
  jobs: GenerationJob[];
}

function getMediaSrc(contentUrl: string | null | undefined) {
  if (!contentUrl) return null;
  if (contentUrl.startsWith('http://') || contentUrl.startsWith('https://')) {
    return contentUrl;
  }
  return `/api/storage/${contentUrl}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusChip({ status }: { status?: string | null }) {
  const color: ChipProps['color'] =
    status === 'completed' ? 'success' :
    status === 'running' || status === 'queued' ? 'warning' :
    status === 'failed' ? 'error' :
    'default';

  return <Chip size="small" label={status || 'unknown'} color={color} />;
}

function PromptText({ prompt }: { prompt?: string | null }) {
  if (!prompt) return <Typography variant="body2" color="text.secondary">プロンプトなし</Typography>;
  return (
    <Typography
      variant="body2"
      sx={{
        color: 'text.secondary',
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}
    >
      {prompt}
    </Typography>
  );
}

function ImageCard({ item }: { item: OutputItem }) {
  const src = getMediaSrc(item.content_url);
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <Box sx={{ height: 220, bgcolor: 'grey.100', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={item.prompt || `image ${item.id}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : (
          <ImageIcon color="disabled" sx={{ fontSize: 56 }} />
        )}
      </Box>
      <CardContent>
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Chip size="small" icon={<ImageIcon />} label={`img_${item.id}`} />
            <Typography variant="caption" color="text.secondary">{formatDate(item.created_at)}</Typography>
          </Stack>
          <PromptText prompt={item.prompt} />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={`動画ジョブ ${item.derived_video_jobs || 0}`} variant="outlined" />
            <Chip size="small" label={`動画結果 ${item.derived_videos || 0}`} variant="outlined" />
          </Stack>
          {src && (
            <MuiLink href={src} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ fontSize: 13 }}>
              素材を開く <OpenInNewIcon sx={{ fontSize: 13, verticalAlign: 'text-bottom' }} />
            </MuiLink>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function VideoCard({ item }: { item: OutputItem }) {
  const src = getMediaSrc(item.content_url);
  const sourceImageSrc = getMediaSrc(item.source_image_url);
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <Box sx={{ bgcolor: 'grey.100' }}>
        {src ? (
          <video src={src} controls preload="metadata" style={{ width: '100%', maxHeight: 260, display: 'block', background: '#111' }} />
        ) : (
          <Box sx={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MovieIcon color="disabled" sx={{ fontSize: 56 }} />
          </Box>
        )}
      </Box>
      <CardContent>
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Chip size="small" icon={<MovieIcon />} label={`vid_${item.id}`} />
            <Typography variant="caption" color="text.secondary">{formatDate(item.created_at)}</Typography>
          </Stack>
          <PromptText prompt={item.prompt} />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {item.generation_job_id && <Chip size="small" label={`job_${item.generation_job_id}`} variant="outlined" />}
            {item.provider && <Chip size="small" label={item.provider} variant="outlined" />}
            {item.job_status && <StatusChip status={item.job_status} />}
          </Stack>
          {item.source_image_id && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {sourceImageSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sourceImageSrc} alt="source" style={{ width: 42, height: 42, objectFit: 'cover', borderRadius: 6 }} />
              )}
              <Typography variant="caption" color="text.secondary">
                source: img_{item.source_image_id}
              </Typography>
            </Box>
          )}
          {src && (
            <MuiLink href={src} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ fontSize: 13 }}>
              動画を開く <OpenInNewIcon sx={{ fontSize: 13, verticalAlign: 'text-bottom' }} />
            </MuiLink>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function JobCard({ job }: { job: GenerationJob }) {
  const src = getMediaSrc(job.latest_result_url);
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Chip size="small" icon={<HubIcon />} label={`job_${job.id}`} />
            <StatusChip status={job.status} />
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={job.job_type} variant="outlined" />
            <Chip size="small" label={job.provider} variant="outlined" />
            {job.model && <Chip size="small" label={job.model} variant="outlined" />}
          </Stack>
          <PromptText prompt={job.prompt} />
          <Typography variant="caption" color="text.secondary">
            inputs {job.input_count} / results {job.result_count} / {formatDate(job.created_at)}
          </Typography>
          <Stack direction="row" spacing={2}>
            {job.external_job_url && (
              <MuiLink href={job.external_job_url} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ fontSize: 13 }}>
                外部ジョブ <OpenInNewIcon sx={{ fontSize: 13, verticalAlign: 'text-bottom' }} />
              </MuiLink>
            )}
            {src && (
              <MuiLink href={src} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ fontSize: 13 }}>
                結果を開く <OpenInNewIcon sx={{ fontSize: 13, verticalAlign: 'text-bottom' }} />
              </MuiLink>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function StudioGenerationsPage() {
  const router = useRouter();
  const params = useParams();
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const studioId = idParam ? parseInt(idParam, 10) : NaN;

  const [tab, setTab] = useState(0);
  const [data, setData] = useState<GenerationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => ({
    images: data?.images.length || 0,
    videos: data?.videos.length || 0,
    jobs: data?.jobs.length || 0,
  }), [data]);

  useEffect(() => {
    if (!Number.isFinite(studioId) || studioId <= 0) {
      setError('無効なスタジオIDです');
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/studios/${studioId}/generations`);
        const json = await response.json();
        if (!response.ok || !json.success) {
          throw new Error(json.error || '生成一覧の読み込みに失敗しました');
        }
        setData(json);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '生成一覧の読み込み中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [studioId]);

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 6, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>生成関連を読み込み中...</Typography>
      </Container>
    );
  }

  if (error || !data) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">{error || 'データがありません'}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.push(`/studios/${studioId}`)} sx={{ mt: 2 }}>
          スタジオに戻る
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Button
        variant="text"
        startIcon={<ArrowBackIcon />}
        onClick={() => router.push(`/studios/${studioId}`)}
        sx={{ mb: 2 }}
      >
        スタジオに戻る
      </Button>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              生成ワークフロー
            </Typography>
            <Typography color="text.secondary">
              {data.studio.name} に関連する画像生成・動画生成・ジョブだけを表示します。
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip icon={<ImageIcon />} label={`画像 ${counts.images}`} />
            <Chip icon={<MovieIcon />} label={`動画 ${counts.videos}`} />
            <Chip icon={<HubIcon />} label={`ジョブ ${counts.jobs}`} />
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">
          <Tab icon={<ImageIcon />} iconPosition="start" label={`画像一覧 (${counts.images})`} />
          <Tab icon={<MovieIcon />} iconPosition="start" label={`動画一覧 (${counts.videos})`} />
          <Tab icon={<HubIcon />} iconPosition="start" label={`生成ジョブ (${counts.jobs})`} />
        </Tabs>
      </Paper>

      {tab === 0 && (
        <Grid container spacing={2.5}>
          {data.images.map((item) => (
            <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <ImageCard item={item} />
            </Grid>
          ))}
          {data.images.length === 0 && <EmptyState label="関連画像がまだありません" />}
        </Grid>
      )}

      {tab === 1 && (
        <Grid container spacing={2.5}>
          {data.videos.map((item) => (
            <Grid key={item.id} size={{ xs: 12, md: 6, lg: 4 }}>
              <VideoCard item={item} />
            </Grid>
          ))}
          {data.videos.length === 0 && <EmptyState label="関連動画がまだありません" />}
        </Grid>
      )}

      {tab === 2 && (
        <Stack spacing={2}>
          {data.jobs.map((job) => <JobCard key={job.id} job={job} />)}
          {data.jobs.length === 0 && <EmptyState label="生成ジョブがまだありません" />}
        </Stack>
      )}
    </Container>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <Grid size={{ xs: 12 }}>
      <Paper sx={{ p: 6, textAlign: 'center' }} variant="outlined">
        <Typography variant="h6" color="text.secondary" gutterBottom>{label}</Typography>
        <Divider sx={{ my: 2 }} />
        <Typography variant="body2" color="text.secondary">
          チャットから生成・登録すると、ここに project / image / video / job の関連だけが出ます。
        </Typography>
      </Paper>
    </Grid>
  );
}
