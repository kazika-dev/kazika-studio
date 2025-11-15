'use client';

import { Box, IconButton, Typography, Slider } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { TimelineBoard } from './boardTypes';
import { useRef, useEffect, useState } from 'react';

interface BoardPreviewPanelProps {
  boards: TimelineBoard[];
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
}

export default function BoardPreviewPanel({
  boards,
  currentTime,
  totalDuration,
  isPlaying,
  onPlay,
  onPause,
  onSeek,
}: BoardPreviewPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [volume, setVolume] = useState(100);
  const [currentBoardTitle, setCurrentBoardTitle] = useState<string>('');

  // 現在時刻でアクティブなボードを取得
  const getActiveBoard = () => {
    return boards.find(
      (board) =>
        Number(board.timeline_start) <= currentTime &&
        currentTime < Number(board.timeline_start) + Number(board.timeline_duration)
    );
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

    const activeBoard = getActiveBoard();
    if (!activeBoard) {
      setCurrentBoardTitle('');
      return;
    }

    setCurrentBoardTitle(activeBoard.title || `シーン ${activeBoard.sequence_order + 1}`);

    // ボード内の最後のWorkflowStepの出力を取得
    const completedSteps = (activeBoard.workflow_steps || [])
      .filter((s) => s.execution_status === 'completed')
      .sort((a, b) => b.step_order - a.step_order);

    const lastStep = completedSteps[0];
    if (!lastStep) {
      // デフォルトメッセージを表示
      ctx.fillStyle = '#666';
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('処理中または出力なし', canvas.width / 2, canvas.height / 2);
      return;
    }

    const relativeTime = currentTime - Number(activeBoard.timeline_start);

    // 画像の描画
    if (lastStep.output_data?.imageUrl || lastStep.output_data?.imageData) {
      const img = new Image();
      const src =
        lastStep.output_data.imageUrl ||
        `data:${lastStep.output_data.imageData?.mimeType};base64,${lastStep.output_data.imageData?.data}`;

      img.onload = () => {
        const scale = Math.min(
          canvas.width / img.width,
          canvas.height / img.height
        );
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const drawX = (canvas.width - drawWidth) / 2;
        const drawY = (canvas.height - drawHeight) / 2;

        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

        // エフェクト適用
        applyBoardEffects(ctx, activeBoard);
      };
      img.src = src;
    }
    // 動画の描画
    else if (lastStep.output_data?.videoUrl) {
      ctx.fillStyle = '#333';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('動画プレビュー', canvas.width / 2, canvas.height / 2 - 20);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#aaa';
      ctx.fillText(lastStep.output_data.videoUrl, canvas.width / 2, canvas.height / 2 + 20);
    }
    // テキストの描画
    else if (lastStep.output_data?.response) {
      ctx.fillStyle = '#fff';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 長いテキストを複数行に分割
      const maxWidth = canvas.width - 100;
      const lines = wrapText(ctx, lastStep.output_data.response, maxWidth);
      const lineHeight = 32;
      const startY = canvas.height / 2 - (lines.length * lineHeight) / 2;

      lines.forEach((line, i) => {
        ctx.fillText(line, canvas.width / 2, startY + i * lineHeight);
      });
    }
  };

  // テキストを複数行に分割
  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  };

  // エフェクト適用
  const applyBoardEffects = (ctx: CanvasRenderingContext2D, board: TimelineBoard) => {
    if (!board.effects) return;

    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    const data = imageData.data;

    // グレースケール
    if (board.effects.filter === 'grayscale') {
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = avg;
        data[i + 1] = avg;
        data[i + 2] = avg;
      }
    }

    // セピア
    if (board.effects.filter === 'sepia') {
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
        data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
        data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
      }
    }

    ctx.putImageData(imageData, 0, 0);
  };

  // プレビューの更新
  useEffect(() => {
    renderPreview();
  }, [currentTime, boards]);

  // 時間のフォーマット
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 前のボード/次のボードへ
  const handlePreviousBoard = () => {
    const activeBoard = getActiveBoard();
    if (!activeBoard) return;

    const currentIndex = boards.findIndex((b) => b.id === activeBoard.id);
    if (currentIndex > 0) {
      onSeek(Number(boards[currentIndex - 1].timeline_start));
    }
  };

  const handleNextBoard = () => {
    const activeBoard = getActiveBoard();
    if (!activeBoard) return;

    const currentIndex = boards.findIndex((b) => b.id === activeBoard.id);
    if (currentIndex < boards.length - 1) {
      onSeek(Number(boards[currentIndex + 1].timeline_start));
    }
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
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          bgcolor: '#000',
          borderRadius: 1,
          mb: 2,
          aspectRatio: '16/9',
          maxHeight: 400,
          position: 'relative',
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

        {/* 現在のシーン名表示 */}
        {currentBoardTitle && (
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              left: 16,
              bgcolor: 'rgba(0,0,0,0.7)',
              color: 'white',
              px: 2,
              py: 1,
              borderRadius: 1,
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {currentBoardTitle}
            </Typography>
          </Box>
        )}
      </Box>

      {/* 再生コントロール */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* 再生ボタン */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton size="small" onClick={handlePreviousBoard} sx={{ color: '#e0e0e0' }}>
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

          <IconButton size="small" onClick={handleNextBoard} sx={{ color: '#e0e0e0' }}>
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
      </Box>
    </Box>
  );
}
