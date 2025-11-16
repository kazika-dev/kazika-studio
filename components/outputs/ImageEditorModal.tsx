'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  Button,
  Box,
  IconButton,
  Typography,
  Slider,
  ToggleButtonGroup,
  ToggleButton,
  AppBar,
  Toolbar
} from '@mui/material';
import { Save, Undo, Close, Edit, Circle, Square, Delete } from '@mui/icons-material';

interface ImageEditorModalProps {
  open: boolean;
  imageUrl: string;
  onClose: () => void;
  onSave: (imageData: { mimeType: string; data: string }) => void;
}

type DrawingMode = 'pen' | 'circle' | 'square' | 'erase';

interface DrawingPath {
  mode: DrawingMode;
  color: string;
  lineWidth: number;
  points: { x: number; y: number }[];
}

export default function ImageEditorModal({ open, imageUrl, onClose, onSave }: ImageEditorModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('pen');
  const [color, setColor] = useState('#FF0000');
  const [lineWidth, setLineWidth] = useState(5);
  const [history, setHistory] = useState<DrawingPath[]>([]);
  const [currentPath, setCurrentPath] = useState<DrawingPath | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // 画像を読み込んでキャンバスに描画
  useEffect(() => {
    if (!open) return;

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
  }, [imageUrl, open]);

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
  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // CanvasをBase64に変換
    const base64Data = canvas.toDataURL('image/png').split(',')[1];
    onSave({
      mimeType: 'image/png',
      data: base64Data,
    });
    handleClose();
  };

  // モーダルを閉じる
  const handleClose = () => {
    setHistory([]);
    setCurrentPath(null);
    setImageLoaded(false);
    onClose();
  };

  const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#000000', '#FFFFFF'];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={false}
      fullScreen
      PaperProps={{
        sx: { bgcolor: '#f5f5f5' }
      }}
    >
      {/* ツールバー */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ mr: 2 }}>
            画像編集
          </Typography>

          <ToggleButtonGroup
            value={drawingMode}
            exclusive
            onChange={(_, value) => value && setDrawingMode(value)}
            size="small"
            sx={{ mr: 2 }}
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

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mr: 2 }}>
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

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', minWidth: 150, mr: 2 }}>
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
              disabled={!imageLoaded}
            >
              保存
            </Button>
            <IconButton onClick={handleClose}>
              <Close />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* キャンバス */}
      <DialogContent sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'auto',
        p: 2
      }}>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            cursor: 'crosshair',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            backgroundColor: 'white',
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
