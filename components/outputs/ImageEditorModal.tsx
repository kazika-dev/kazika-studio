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
import { Save, Undo, Close, Edit, Circle, Square, Delete, Highlight, TextFields, OpenWith } from '@mui/icons-material';
import TextInputDialog, { TextConfig } from './TextInputDialog';

interface ImageEditorModalProps {
  open: boolean;
  imageUrl: string;
  onClose: () => void;
  onSave: (imageData: { mimeType: string; data: string }) => void;
}

type DrawingMode = 'pen' | 'marker' | 'circle' | 'square' | 'erase' | 'text' | 'move';

interface DrawingPath {
  mode: DrawingMode;
  color: string;
  lineWidth: number;
  opacity: number;
  points: { x: number; y: number }[];
  // テキスト用のフィールド
  text?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
}

export default function ImageEditorModal({ open, imageUrl, onClose, onSave }: ImageEditorModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('marker');
  const [color, setColor] = useState('#FFFF00');
  const [lineWidth, setLineWidth] = useState(30);
  const [opacity, setOpacity] = useState(0.5);
  const [history, setHistory] = useState<DrawingPath[]>([]);
  const [currentPath, setCurrentPath] = useState<DrawingPath | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [pendingTextPosition, setPendingTextPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedTextIndex, setSelectedTextIndex] = useState<number | null>(null);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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

  // テキストの境界ボックスを計算
  const getTextBoundingBox = (path: DrawingPath, ctx: CanvasRenderingContext2D) => {
    if (path.mode !== 'text' || !path.text) return null;

    ctx.font = `${path.fontStyle || 'normal'} ${path.fontWeight || 'normal'} ${path.fontSize || 32}px sans-serif`;
    const metrics = ctx.measureText(path.text);
    const width = metrics.width;
    const height = path.fontSize || 32;

    return {
      x: path.points[0].x,
      y: path.points[0].y - height,
      width,
      height: height * 1.2, // 余白を追加
    };
  };

  // クリック位置がテキストの境界内にあるかチェック
  const findTextAtPosition = (x: number, y: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return -1;

    // 後ろから検索（最後に描画されたものが優先）
    for (let i = history.length - 1; i >= 0; i--) {
      const path = history[i];
      if (path.mode === 'text') {
        const box = getTextBoundingBox(path, ctx);
        if (box && x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) {
          return i;
        }
      }
    }
    return -1;
  };

  // 履歴を再描画
  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !imageRef.current) return;

    // 画像を再描画
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageRef.current, 0, 0);

    // すべてのパスを再描画
    history.forEach((path, index) => {
      drawPath(ctx, path);

      // 選択されたテキストには境界ボックスを表示
      if (drawingMode === 'move' && index === selectedTextIndex && path.mode === 'text') {
        const box = getTextBoundingBox(path, ctx);
        if (box) {
          ctx.strokeStyle = '#1976d2';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(box.x, box.y, box.width, box.height);
          ctx.setLineDash([]);
        }
      }
    });
  };

  // パスを描画
  const drawPath = (ctx: CanvasRenderingContext2D, path: DrawingPath) => {
    if (path.points.length === 0) return;

    ctx.lineWidth = path.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (path.mode === 'text' && path.text) {
      // テキストを描画
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = `${path.fontStyle || 'normal'} ${path.fontWeight || 'normal'} ${path.fontSize || 32}px sans-serif`;
      ctx.fillStyle = path.color;
      ctx.fillText(path.text, path.points[0].x, path.points[0].y);
    } else if (path.mode === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = path.color;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      // 半透明カラーを設定
      const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };
      ctx.strokeStyle = hexToRgba(path.color, path.opacity);
      ctx.fillStyle = hexToRgba(path.color, path.opacity);
    }

    if (path.mode === 'pen' || path.mode === 'marker' || path.mode === 'erase') {
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

    // テキストモードの場合はダイアログを表示
    if (drawingMode === 'text') {
      setPendingTextPosition({ x, y });
      setTextDialogOpen(true);
      return;
    }

    // 移動モードの場合はテキストを選択
    if (drawingMode === 'move') {
      const textIndex = findTextAtPosition(x, y);
      if (textIndex !== -1) {
        setSelectedTextIndex(textIndex);
        setIsDraggingText(true);
        const textPath = history[textIndex];
        setDragOffset({
          x: x - textPath.points[0].x,
          y: y - textPath.points[0].y,
        });
      } else {
        setSelectedTextIndex(null);
      }
      redrawCanvas();
      return;
    }

    setIsDrawing(true);
    setCurrentPath({
      mode: drawingMode,
      color: drawingMode === 'erase' ? '#FFFFFF' : color,
      lineWidth,
      opacity,
      points: [{ x, y }],
    });
  };

  // 描画中
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // テキストをドラッグ中
    if (isDraggingText && selectedTextIndex !== null) {
      const newHistory = [...history];
      const textPath = newHistory[selectedTextIndex];
      textPath.points = [{ x: x - dragOffset.x, y: y - dragOffset.y }];
      setHistory(newHistory);
      redrawCanvas();
      return;
    }

    if (!isDrawing || !currentPath) return;

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
    if (isDraggingText) {
      setIsDraggingText(false);
      return;
    }

    if (currentPath && currentPath.points.length > 0) {
      setHistory([...history, currentPath]);
    }
    setIsDrawing(false);
    setCurrentPath(null);
  };

  // テキスト追加
  const handleAddText = (config: TextConfig) => {
    if (!pendingTextPosition) return;

    const textPath: DrawingPath = {
      mode: 'text',
      color: config.color,
      lineWidth: 0,
      opacity: 1,
      points: [pendingTextPosition],
      text: config.text,
      fontSize: config.fontSize,
      fontWeight: config.fontWeight,
      fontStyle: config.fontStyle,
    };

    setHistory([...history, textPath]);
    setPendingTextPosition(null);
    setTimeout(() => redrawCanvas(), 0);
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
            <ToggleButton value="pen" title="ペン">
              <Edit />
            </ToggleButton>
            <ToggleButton value="marker" title="マーカー">
              <Highlight />
            </ToggleButton>
            <ToggleButton value="circle" title="円">
              <Circle />
            </ToggleButton>
            <ToggleButton value="square" title="四角">
              <Square />
            </ToggleButton>
            <ToggleButton value="text" title="テキスト">
              <TextFields />
            </ToggleButton>
            <ToggleButton value="move" title="移動">
              <OpenWith />
            </ToggleButton>
            <ToggleButton value="erase" title="消しゴム">
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
              max={80}
              size="small"
            />
            <Typography variant="caption" sx={{ minWidth: 30 }}>{lineWidth}</Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', minWidth: 150, mr: 2 }}>
            <Typography variant="body2">透明度:</Typography>
            <Slider
              value={opacity}
              onChange={(_, value) => setOpacity(value as number)}
              min={0.1}
              max={1}
              step={0.1}
              size="small"
            />
            <Typography variant="caption" sx={{ minWidth: 30 }}>{Math.round(opacity * 100)}%</Typography>
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

      {/* テキスト入力ダイアログ */}
      <TextInputDialog
        open={textDialogOpen}
        onClose={() => {
          setTextDialogOpen(false);
          setPendingTextPosition(null);
        }}
        onConfirm={handleAddText}
      />
    </Dialog>
  );
}
