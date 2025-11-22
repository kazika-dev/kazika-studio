'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Button, Box, IconButton, Typography, Paper, Slider, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { Save, Undo, Close, Edit, Circle, Square, Delete, Highlight, TextFields, OpenWith, CropFree } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import TextInputDialog, { TextConfig } from './TextInputDialog';

interface ImageEditorProps {
  imageUrl: string;
  originalOutputId?: string;
  onSave?: (imageBlob: Blob) => void;
  onClose?: () => void;
}

type DrawingMode = 'pen' | 'marker' | 'circle' | 'square' | 'erase' | 'text' | 'move' | 'select';

interface SelectionArea {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  imageData?: ImageData;
  isDragging?: boolean;
  originalX?: number;  // 選択時の元のX座標
  originalY?: number;  // 選択時の元のY座標
  savedImageBeforeMove?: HTMLImageElement;  // 移動前の画像状態（キャンセル用）
}

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

export default function ImageEditor({ imageUrl, originalOutputId, onSave, onClose }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('marker');
  const [color, setColor] = useState('#FFFF00');
  const [lineWidth, setLineWidth] = useState(30);
  const [opacity, setOpacity] = useState(0.5);
  const [history, setHistory] = useState<DrawingPath[]>([]);
  const [currentPath, setCurrentPath] = useState<DrawingPath | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const router = useRouter();
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [pendingTextPosition, setPendingTextPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedTextIndex, setSelectedTextIndex] = useState<number | null>(null);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selection, setSelection] = useState<SelectionArea | null>(null);
  const [isCreatingSelection, setIsCreatingSelection] = useState(false);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);

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

    // 選択範囲を描画
    if (selection) {
      const { startX, startY, endX, endY } = selection;
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);
      const width = Math.abs(endX - startX);
      const height = Math.abs(endY - startY);

      // 移動中の場合は画像データを表示
      if (isDraggingSelection && selection.imageData) {
        ctx.putImageData(selection.imageData, x, y);
      }

      // 選択範囲の枠線を描画（点線）
      ctx.strokeStyle = '#1976d2';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);

      // コーナーのハンドルを描画
      ctx.fillStyle = '#1976d2';
      const handleSize = 8;
      const corners = [
        { x: x, y: y },
        { x: x + width, y: y },
        { x: x, y: y + height },
        { x: x + width, y: y + height },
      ];
      corners.forEach(corner => {
        ctx.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
      });
    }
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

  // 選択範囲内かチェック
  const isInsideSelection = (x: number, y: number) => {
    if (!selection) return false;
    const sx = Math.min(selection.startX, selection.endX);
    const sy = Math.min(selection.startY, selection.endY);
    const ex = Math.max(selection.startX, selection.endX);
    const ey = Math.max(selection.startY, selection.endY);
    return x >= sx && x <= ex && y >= sy && y <= ey;
  };

  // 描画開始
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
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

    // 選択モードの場合
    if (drawingMode === 'select') {
      // 既存の選択範囲内をクリックした場合は移動モード
      if (selection && isInsideSelection(x, y)) {
        // 移動開始時に元の位置を白で塗りつぶす前に、現在の画像状態を保存
        if (selection.originalX !== undefined && selection.originalY !== undefined && ctx && imageRef.current) {
          // キャンセル用に現在の画像を保存
          const savedImage = new Image();
          savedImage.src = imageRef.current.src;

          const width = Math.abs(selection.endX - selection.startX);
          const height = Math.abs(selection.endY - selection.startY);

          // 元の位置を白で塗りつぶす
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(selection.originalX, selection.originalY, width, height);

          // 画像参照を更新
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            tempCtx.drawImage(canvas, 0, 0);
            const img = new Image();
            img.onload = () => {
              imageRef.current = img;
            };
            img.src = tempCanvas.toDataURL();
          }

          // 選択範囲に保存した画像を記録
          setSelection({
            ...selection,
            savedImageBeforeMove: savedImage,
          });
        }

        setIsDraggingSelection(true);
        setDragOffset({
          x: x - Math.min(selection.startX, selection.endX),
          y: y - Math.min(selection.startY, selection.endY),
        });
      } else {
        // 新しい選択範囲を作成
        setIsCreatingSelection(true);
        setSelection({
          startX: x,
          startY: y,
          endX: x,
          endY: y,
        });
      }
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

    // 選択範囲をドラッグ中
    if (isDraggingSelection && selection) {
      const width = Math.abs(selection.endX - selection.startX);
      const height = Math.abs(selection.endY - selection.startY);
      const newX = x - dragOffset.x;
      const newY = y - dragOffset.y;

      setSelection({
        ...selection,
        startX: newX,
        startY: newY,
        endX: newX + width,
        endY: newY + height,
      });
      redrawCanvas();
      return;
    }

    // 選択範囲を作成中
    if (isCreatingSelection && selection) {
      setSelection({
        ...selection,
        endX: x,
        endY: y,
      });
      redrawCanvas();
      return;
    }

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
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (isDraggingSelection) {
      setIsDraggingSelection(false);
      return;
    }

    if (isCreatingSelection && selection && ctx) {
      // 選択範囲が作成された - 画像データを保存（切り取りはしない）
      const x = Math.min(selection.startX, selection.endX);
      const y = Math.min(selection.startY, selection.endY);
      const width = Math.abs(selection.endX - selection.startX);
      const height = Math.abs(selection.endY - selection.startY);

      if (width > 0 && height > 0) {
        // 選択範囲の画像データを保存
        const imageData = ctx.getImageData(x, y, width, height);

        setSelection({
          ...selection,
          imageData,
          originalX: x,  // 元の位置を記録
          originalY: y,
        });
      }
      setIsCreatingSelection(false);
      return;
    }

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

  // 選択範囲を削除
  const handleDeleteSelection = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !selection) return;

    // 選択範囲を白で塗りつぶす
    const x = Math.min(selection.startX, selection.endX);
    const y = Math.min(selection.startY, selection.endY);
    const width = Math.abs(selection.endX - selection.startX);
    const height = Math.abs(selection.endY - selection.startY);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, width, height);

    // 画像参照を更新
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.drawImage(canvas, 0, 0);
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
      };
      img.src = tempCanvas.toDataURL();
    }

    // 選択範囲をクリア
    setSelection(null);
    redrawCanvas();
  };

  // 選択範囲を確定（画像に貼り付け）
  const handleConfirmSelection = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !selection || !selection.imageData) return;

    const x = Math.min(selection.startX, selection.endX);
    const y = Math.min(selection.startY, selection.endY);

    // 現在の位置に画像データを描画
    ctx.putImageData(selection.imageData, x, y);

    // 画像参照を更新
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.drawImage(canvas, 0, 0);
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
      };
      img.src = tempCanvas.toDataURL();
    }

    // 選択範囲をクリア
    setSelection(null);
    redrawCanvas();
  };

  // 選択をキャンセル
  const handleCancelSelection = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !selection) return;

    // 移動開始前の画像が保存されている場合は復元
    if (selection.savedImageBeforeMove) {
      selection.savedImageBeforeMove.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(selection.savedImageBeforeMove!, 0, 0);
        imageRef.current = selection.savedImageBeforeMove!;
        setSelection(null);
        redrawCanvas();
      };
      // 画像が既にロード済みの場合
      if (selection.savedImageBeforeMove.complete) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(selection.savedImageBeforeMove, 0, 0);
        imageRef.current = selection.savedImageBeforeMove;
      }
    }

    // 選択範囲をクリア
    setSelection(null);
    redrawCanvas();
  };

  // キーボードイベントを処理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Deleteキーで選択範囲を削除
      if (e.key === 'Delete' && selection && drawingMode === 'select') {
        handleDeleteSelection();
      }
      // Enterキーで選択範囲を確定
      if (e.key === 'Enter' && selection && drawingMode === 'select') {
        handleConfirmSelection();
      }
      // Escapeキーで選択をキャンセル
      if (e.key === 'Escape' && selection) {
        handleCancelSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, drawingMode]);

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
            <ToggleButton value="select" title="選択">
              <CropFree />
            </ToggleButton>
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

          {/* 選択範囲の操作ボタン */}
          {selection && drawingMode === 'select' && (
            <Box sx={{ display: 'flex', gap: 1, borderLeft: '1px solid #ddd', pl: 2, ml: 2 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleConfirmSelection}
              >
                確定 (Enter)
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="error"
                onClick={handleDeleteSelection}
              >
                削除 (Delete)
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleCancelSelection}
              >
                キャンセル (Esc)
              </Button>
            </Box>
          )}

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
              max={80}
              size="small"
            />
            <Typography variant="caption" sx={{ minWidth: 30 }}>{lineWidth}</Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', minWidth: 150 }}>
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
            cursor:
              drawingMode === 'select' ? 'crosshair' :
              drawingMode === 'move' ? 'move' :
              drawingMode === 'text' ? 'text' :
              drawingMode === 'erase' ? 'crosshair' :
              'crosshair',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          }}
        />
      </Box>

      {/* テキスト入力ダイアログ */}
      <TextInputDialog
        open={textDialogOpen}
        onClose={() => {
          setTextDialogOpen(false);
          setPendingTextPosition(null);
        }}
        onConfirm={handleAddText}
      />
    </Box>
  );
}
