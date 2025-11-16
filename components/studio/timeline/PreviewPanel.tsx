'use client';

import { Box, IconButton, Typography, Slider } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { TimelineStep } from './types';
import { useRef, useEffect, useState } from 'react';

interface PreviewPanelProps {
  steps: TimelineStep[];
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
}

export default function PreviewPanel({
  steps,
  currentTime,
  totalDuration,
  isPlaying,
  onPlay,
  onPause,
  onSeek,
}: PreviewPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [volume, setVolume] = useState(100);

  // 現在時刻でアクティブなステップを取得
  const getActiveSteps = () => {
    return steps
      .filter(
        (step) =>
          step.timeline_start <= currentTime &&
          currentTime < step.timeline_start + step.timeline_duration &&
          step.execution_status === 'completed'
      )
      .sort((a, b) => a.timeline_layer - b.timeline_layer);
  };

  // プレビューのレンダリング
  const renderPreview = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // キャンバスをクリア
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const activeSteps = getActiveSteps();

    // 各ステップを描画
    activeSteps.forEach((step) => {
      const progress = (currentTime - step.timeline_start) / step.timeline_duration;

      // 基本の不透明度
      let opacity = step.effects?.opacity ?? 1;

      // トランジション適用
      if (step.transition_in && progress < step.transition_in.duration / step.timeline_duration) {
        const transitionProgress = progress / (step.transition_in.duration / step.timeline_duration);
        if (step.transition_in.type === 'fade') {
          opacity *= transitionProgress;
        }
      }

      const transitionOutStart = 1 - (step.transition_out?.duration ?? 0) / step.timeline_duration;
      if (step.transition_out && progress > transitionOutStart) {
        const transitionProgress = (progress - transitionOutStart) / (1 - transitionOutStart);
        if (step.transition_out.type === 'fade') {
          opacity *= 1 - transitionProgress;
        }
      }

      ctx.globalAlpha = opacity;

      // 画像の描画
      if (step.output_data?.imageUrl || step.output_data?.imageData) {
        const img = new Image();
        const src = step.output_data.imageUrl ||
                    `data:${step.output_data.imageData?.mimeType};base64,${step.output_data.imageData?.data}`;

        img.onload = () => {
          const scale = step.effects?.scale ?? 1;
          const x = step.effects?.position?.x ?? 0;
          const y = step.effects?.position?.y ?? 0;

          const drawWidth = canvas.width * scale;
          const drawHeight = (img.height / img.width) * drawWidth;
          const drawX = (canvas.width - drawWidth) / 2 + x;
          const drawY = (canvas.height - drawHeight) / 2 + y;

          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        };
        img.src = src;
      }

      // テキストの描画
      if (step.output_data?.response && step.timeline_track === 'text') {
        ctx.fillStyle = '#fff';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const x = (step.effects?.position?.x ?? 0) + canvas.width / 2;
        const y = (step.effects?.position?.y ?? 0) + canvas.height / 2;

        ctx.fillText(step.output_data.response.substring(0, 100), x, y);
      }

      ctx.globalAlpha = 1;
    });
  };

  // プレビューの更新
  useEffect(() => {
    renderPreview();
  }, [currentTime, steps]);

  // 時間のフォーマット
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 1秒戻る/進む
  const handleSkipBackward = () => {
    onSeek(Math.max(0, currentTime - 1));
  };

  const handleSkipForward = () => {
    onSeek(Math.min(totalDuration, currentTime + 1));
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#1e1e1e',
        p: 2,
      }}
    >
      {/* プレビューキャンバス */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          bgcolor: '#000',
          borderRadius: 1,
          mb: 2,
          aspectRatio: '16/9',
          maxHeight: 400,
        }}
      >
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </Box>

      {/* 再生コントロール */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* 再生ボタン */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton size="small" onClick={handleSkipBackward} sx={{ color: '#e0e0e0' }}>
            <SkipPreviousIcon />
          </IconButton>

          <IconButton
            onClick={isPlaying ? onPause : onPlay}
            sx={{
              color: '#fff',
              bgcolor: '#1976d2',
              '&:hover': { bgcolor: '#1565c0' },
            }}
          >
            {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>

          <IconButton size="small" onClick={handleSkipForward} sx={{ color: '#e0e0e0' }}>
            <SkipNextIcon />
          </IconButton>
        </Box>

        {/* タイムコード */}
        <Typography variant="caption" sx={{ color: '#9e9e9e', minWidth: 80 }}>
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </Typography>

        {/* 音量 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
          <VolumeUpIcon fontSize="small" sx={{ color: '#9e9e9e' }} />
          <Slider
            value={volume}
            onChange={(_, value) => setVolume(value as number)}
            min={0}
            max={100}
            size="small"
            sx={{
              maxWidth: 120,
              color: '#1976d2',
            }}
          />
        </Box>

        {/* フルスクリーン */}
        <IconButton size="small" sx={{ color: '#e0e0e0' }}>
          <FullscreenIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
