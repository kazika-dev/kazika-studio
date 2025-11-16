'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Button, Box, IconButton, Typography, Paper, Slider, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { Save, Undo, Close, Edit, Circle, Square, Delete } from '@mui/icons-material';
import { useRouter } from 'next/navigation';

interface ImageEditorProps {
  imageUrl: string;
  originalOutputId?: string;
  onSave?: (imageBlob: Blob) => void;
  onClose?: () => void;
}

type DrawingMode = 'pen' | 'circle' | 'square' | 'erase';

interface DrawingPath {
  mode: DrawingMode;
  color: string;
  lineWidth: number;
  points: { x: number; y: number }[];
}

export default function ImageEditor({ imageUrl, originalOutputId, onSave, onClose }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('pen');
  const [color, setColor] = useState('#FF0000');
  const [lineWidth, setLineWidth] = useState(5);
  const [history, setHistory] = useState<DrawingPath[]>([]);
  const [currentPath, setCurrentPath] = useState<DrawingPath | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const router = useRouter();

  // 画像を読み込んでキャンバスに描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // キャンバスサイズを画像に合わせる
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // 履歴を再描画
  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !imageRef.current) return;

    // 画像を再描画
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageRef.current, 0, 0);

    // すべてのパスを再描画
    history.forEach(path => {
      drawPath(ctx, path);
    });
  };

  // パスを描画
  const drawPath = (ctx: CanvasRenderingContext2D, path: DrawingPath) => {
    if (path.points.length === 0) return;

    ctx.strokeStyle = path.color;
    ctx.lineWidth = path.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (path.mode === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    if (path.mode === 'pen' || path.mode === 'erase') {
      // フリーハンド描画
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      path.points.forEach(point => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    } else if (path.mode === 'circle' && path.points.length >= 2) {
      // 円を描画
      const start = path.points[0];
      const end = path.points[path.points.length - 1];
      const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
      ctx.beginPath();
      ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (path.mode === 'square' && path.points.length >= 2) {
      // 四角形を描画
      const start = path.points[0];
      const end = path.points[path.points.length - 1];
      ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    }

    ctx.globalCompositeOperation = 'source-over';
  };

  // 描画開始
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageLoaded) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setIsDrawing(true);
    setCurrentPath({
      mode: drawingMode,
      color: drawingMode === 'erase' ? '#FFFFFF' : color,
      lineWidth,
      points: [{ x, y }],
    });
  };

  // 描画中
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentPath) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const newPath = {
      ...currentPath,
      points: [...currentPath.points, { x, y }],
    };
    setCurrentPath(newPath);

    // リアルタイムで描画
    redrawCanvas();
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawPath(ctx, newPath);
    }
  };

  // 描画終了
  const stopDrawing = () => {
    if (currentPath && currentPath.points.length > 0) {
      setHistory([...history, currentPath]);
    }
    setIsDrawing(false);
    setCurrentPath(null);
  };

  // 元に戻す
  const handleUndo = () => {
    if (history.length === 0) return;
    const newHistory = history.slice(0, -1);
    setHistory(newHistory);
    setTimeout(() => redrawCanvas(), 0);
  };

  // 保存
  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setSaving(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/png');
      });

      if (onSave) {
        await onSave(blob);
      } else {
        // デフォルトの保存処理
        const formData = new FormData();
        formData.append('file', blob, 'edited-image.png');
        if (originalOutputId) {
          formData.append('originalOutputId', originalOutputId);
        }

        const response = await fetch('/api/outputs/save-edited', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to save image');
        }

        alert('画像を保存しました！');
        router.push('/outputs');
      }
    } catch (error) {
      console.error('Failed to save image:', error);
      alert('画像の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#000000', '#FFFFFF'];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#f5f5f5' }}>
      {/* ツールバー */}
      <Paper sx={{ p: 2, borderRadius: 0 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="h6">画像編集</Typography>

          <ToggleButtonGroup
            value={drawingMode}
            exclusive
            onChange={(_, value) => value && setDrawingMode(value)}
            size="small"
          >
            <ToggleButton value="pen">
              <Edit />
            </ToggleButton>
            <ToggleButton value="circle">
              <Circle />
            </ToggleButton>
            <ToggleButton value="square">
              <Square />
            </ToggleButton>
            <ToggleButton value="erase">
              <Delete />
            </ToggleButton>
          </ToggleButtonGroup>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography variant="body2">色:</Typography>
            {colors.map(c => (
              <Box
                key={c}
                onClick={() => setColor(c)}
                sx={{
                  width: 24,
                  height: 24,
                  bgcolor: c,
                  border: color === c ? '3px solid #000' : '1px solid #ccc',
                  borderRadius: '50%',
                  cursor: 'pointer',
                }}
              />
            ))}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', minWidth: 150 }}>
            <Typography variant="body2">太さ:</Typography>
            <Slider
              value={lineWidth}
              onChange={(_, value) => setLineWidth(value as number)}
              min={1}
              max={20}
              size="small"
            />
          </Box>

          <Box sx={{ marginLeft: 'auto', display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<Undo />}
              onClick={handleUndo}
              disabled={history.length === 0}
            >
              元に戻す
            </Button>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={!imageLoaded || saving}
            >
              {saving ? '保存中...' : '保存'}
            </Button>
            {onClose && (
              <IconButton onClick={onClose}>
                <Close />
              </IconButton>
            )}
          </Box>
        </Box>
      </Paper>

      {/* キャンバス */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'auto',
          p: 2,
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            cursor: drawingMode === 'erase' ? 'crosshair' : 'crosshair',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          }}
        />
      </Box>
    </Box>
  );
}
