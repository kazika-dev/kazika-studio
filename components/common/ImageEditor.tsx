'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button, Box, IconButton, Typography, Paper, Slider, ToggleButtonGroup, ToggleButton, TextField, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Save, Undo, Close, Edit, Circle, Square, Delete, Highlight, TextFields, OpenWith, CropFree, FileCopy, ContentCopy, ContentPaste } from '@mui/icons-material';

interface ImageEditorProps {
  imageUrl: string;
  onSave?: (imageBlob: Blob, saveMode?: 'overwrite' | 'new') => void | Promise<void>;
  onClose?: () => void;
  // デフォルトの保存処理を無効化（onSaveが必須になる）
  disableDefaultSave?: boolean;
  // 保存モード選択を有効化（true: 保存時にモード選択ダイアログを表示）
  enableSaveModeSelection?: boolean;
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

export default function ImageEditor({ imageUrl, onSave, onClose, disableDefaultSave = false, enableSaveModeSelection = false }: ImageEditorProps) {
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
  const [imageHistory, setImageHistory] = useState<HTMLImageElement[]>([]);  // 画像の履歴（Undo用）
  const [isEditingText, setIsEditingText] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null);
  const [textConfig, setTextConfig] = useState({ fontSize: 32, fontWeight: 'normal' as 'normal' | 'bold', fontStyle: 'normal' as 'normal' | 'italic' });
  const textInputRef = useRef<HTMLInputElement>(null);
  const [displayScale, setDisplayScale] = useState(1); // Canvas表示スケール
  const [selectedTextIndex, setSelectedTextIndex] = useState<number | null>(null);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selection, setSelection] = useState<SelectionArea | null>(null);
  const [isCreatingSelection, setIsCreatingSelection] = useState(false);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [redrawTrigger, setRedrawTrigger] = useState(0);  // Canvas再描画のトリガー
  const [saveModeDialogOpen, setSaveModeDialogOpen] = useState(false);
  const [pendingSaveBlob, setPendingSaveBlob] = useState<Blob | null>(null);
  const [pastedImage, setPastedImage] = useState<{ imageData: ImageData; x: number; y: number } | null>(null);
  const [isDraggingPasted, setIsDraggingPasted] = useState(false);
  const [pastedDragOffset, setPastedDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // 画像を読み込んでキャンバスに描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();

    // /api/storage プロキシ経由の場合は同じオリジンなのでcrossOriginは不要
    // 外部URLの場合のみcrossOriginを設定
    if (imageUrl.startsWith('http') && !imageUrl.startsWith(window.location.origin)) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      // キャンバスサイズを画像に合わせる
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      imageRef.current = img;
      setImageLoaded(true);
    };

    img.onerror = (error) => {
      console.error('Failed to load image:', error);
      console.error('Image URL:', imageUrl);
      alert('画像の読み込みに失敗しました。URLを確認してください。');
    };

    img.src = imageUrl;
  }, [imageUrl]);

  // redrawTriggerが変更されたときにCanvasを再描画
  useEffect(() => {
    if (redrawTrigger > 0) {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      redrawCanvas();
      // 選択範囲がある場合は枠線も再描画
      if (selection) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        drawSelectionOverlay();
      }
      // 貼り付け画像がある場合も再描画
      if (pastedImage) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        drawPastedImageOverlay();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redrawTrigger, selection, pastedImage]);

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

  // 選択範囲の枠線を描画（一時的な表示用、実際のcanvasには焼き込まない）
  const drawSelectionOverlay = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !selection) return;

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

  // 画像の履歴に追加
  const saveImageToHistory = () => {
    if (imageRef.current) {
      const newHistory = [...imageHistory, imageRef.current];
      // 履歴は最大20個まで
      if (newHistory.length > 20) {
        newHistory.shift();
      }
      setImageHistory(newHistory);
    }
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

    // テキストモードの場合はcanvas上に直接入力フィールドを表示
    if (drawingMode === 'text') {
      // 既存のテキスト入力があれば先に確定
      if (isEditingText && textInput.trim() && textPosition) {
        // 古いテキストを確定
        const oldTextPath: DrawingPath = {
          mode: 'text',
          color: color,
          lineWidth: 0,
          opacity: 1,
          points: [{
            x: textPosition.canvasX,
            y: textPosition.canvasY + textConfig.fontSize
          }],
          text: textInput,
          fontSize: textConfig.fontSize,
          fontWeight: textConfig.fontWeight,
          fontStyle: textConfig.fontStyle,
        };

        // historyを更新
        const newHistory = [...history, oldTextPath];
        setHistory(newHistory);

        // 即座にCanvasに描画（新しい履歴を使って完全に再描画）
        const ctx = canvas.getContext('2d');
        if (ctx && imageRef.current) {
          // 画像をクリアして再描画
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(imageRef.current, 0, 0);

          // 新しい履歴を含めてすべてのパスを再描画
          newHistory.forEach(path => {
            drawPath(ctx, path);
          });
        }

        // 状態をクリア
        setTextInput('');
      }

      // 表示用のスケールを計算（Canvas表示サイズ / Canvas実サイズ）
      const scale = rect.width / canvas.width;
      setDisplayScale(scale);

      // 新しい位置を設定
      setTextPosition({
        x: e.clientX,  // ページ全体での絶対X座標
        y: e.clientY,  // ページ全体での絶対Y座標
        canvasX: x,    // Canvas内での相対X座標（スケール済み）
        canvasY: y,    // Canvas内での相対Y座標（スケール済み）
      });
      setIsEditingText(true);
      // 次のフレームでフォーカス
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 0);
      return;
    }

    // 選択モードの場合
    if (drawingMode === 'select') {
      // 貼り付け画像内をクリックした場合は移動モード
      if (pastedImage && isInsidePastedImage(x, y)) {
        setIsDraggingPasted(true);
        setPastedDragOffset({
          x: x - pastedImage.x,
          y: y - pastedImage.y,
        });
        return;
      }

      // 貼り付け画像外をクリックした場合は確定してから次の操作
      if (pastedImage && !isInsidePastedImage(x, y)) {
        handleConfirmPasted();
        return;
      }

      // 既存の選択範囲内をクリックした場合は移動モード
      if (selection && isInsideSelection(x, y)) {
        // 移動開始時に元の位置を白で塗りつぶす前に、現在の画像状態を保存
        if (selection.originalX !== undefined && selection.originalY !== undefined && ctx && imageRef.current) {
          // Undo用に履歴を保存
          saveImageToHistory();

          // キャンセル用に現在の画像を保存
          const savedImage = new Image();
          savedImage.src = imageRef.current.src;

          const width = Math.abs(selection.endX - selection.startX);
          const height = Math.abs(selection.endY - selection.startY);

          // 一時Canvasに点線を含まない状態を再構築
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            // 元の画像を描画
            tempCtx.drawImage(imageRef.current, 0, 0);

            // 描画履歴を再描画
            history.forEach(path => {
              drawPath(tempCtx, path);
            });

            // 元の位置を白で塗りつぶす
            tempCtx.fillStyle = '#FFFFFF';
            tempCtx.fillRect(selection.originalX, selection.originalY, width, height);

            // 画像参照を非同期で更新
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
        // 既存の選択範囲があれば、移動されているかチェック
        if (selection) {
          const currentX = Math.min(selection.startX, selection.endX);
          const currentY = Math.min(selection.startY, selection.endY);
          const hasMoved = selection.originalX !== undefined &&
                          selection.originalY !== undefined &&
                          (currentX !== selection.originalX || currentY !== selection.originalY);

          // 移動されている場合は確定してから新しい選択範囲を作成
          if (hasMoved && selection.imageData) {
            // 確定処理（handleConfirmSelection と同じ）
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx && imageRef.current) {
              // 元の画像を描画
              tempCtx.drawImage(imageRef.current, 0, 0);

              // 描画履歴を再描画
              history.forEach(path => {
                drawPath(tempCtx, path);
              });

              // 現在の位置に画像データを貼り付け
              tempCtx.putImageData(selection.imageData, currentX, currentY);

              // 画像参照を非同期で更新
              const img = new Image();
              img.onload = () => {
                imageRef.current = img;
              };
              img.src = tempCanvas.toDataURL();
            }

            // 選択範囲をクリア
            setSelection(null);
          } else {
            // 移動されていない場合は単にクリア
            setSelection(null);
            // 即座に再描画（選択範囲の枠線を消す）
            if (ctx && imageRef.current) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(imageRef.current, 0, 0);
              history.forEach(path => {
                drawPath(ctx, path);
              });
            }
          }
        }

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

    // 貼り付け画像をドラッグ中
    if (isDraggingPasted && pastedImage) {
      const newX = x - pastedDragOffset.x;
      const newY = y - pastedDragOffset.y;
      setPastedImage({
        ...pastedImage,
        x: newX,
        y: newY,
      });
      redrawCanvas();
      drawPastedImageOverlay();
      return;
    }

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
      drawSelectionOverlay(); // 点線を一時的に表示
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
      drawSelectionOverlay(); // 点線を一時的に表示
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

    if (isDraggingPasted) {
      setIsDraggingPasted(false);
      return;
    }

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

      if (width > 0 && height > 0 && imageRef.current) {
        // 一時Canvasに点線を含まない状態を再構築
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas?.width ?? 0;
        tempCanvas.height = canvas?.height ?? 0;
        const tempCtx = tempCanvas.getContext('2d');

        if (tempCtx) {
          // 元の画像を描画
          tempCtx.drawImage(imageRef.current, 0, 0);

          // 描画履歴を再描画
          history.forEach(path => {
            drawPath(tempCtx, path);
          });

          // 点線を含まない状態から選択範囲の画像データを取得
          const imageData = tempCtx.getImageData(x, y, width, height);

          setSelection({
            ...selection,
            imageData,
            originalX: x,  // 元の位置を記録
            originalY: y,
          });

          // 選択範囲の枠線を表示
          redrawCanvas();
          drawSelectionOverlay();
        }
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

  // テキスト追加を確定
  const handleConfirmText = () => {
    if (!textInput.trim() || !textPosition) {
      setIsEditingText(false);
      return;
    }

    // テキストのベースライン位置を調整（フォントサイズ分だけ下げる）
    const textPath: DrawingPath = {
      mode: 'text',
      color: color,
      lineWidth: 0,
      opacity: 1,
      points: [{
        x: textPosition.canvasX,  // 既にスケール済みのCanvas座標を使用
        y: textPosition.canvasY + textConfig.fontSize  // フォントサイズ分だけ下げる（ベースライン調整）
      }],
      text: textInput,
      fontSize: textConfig.fontSize,
      fontWeight: textConfig.fontWeight,
      fontStyle: textConfig.fontStyle,
    };

    // historyを更新
    const newHistory = [...history, textPath];
    setHistory(newHistory);

    // 即座にCanvasに描画（新しい履歴を使って完全に再描画）
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx && imageRef.current) {
      // 画像をクリアして再描画
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imageRef.current, 0, 0);

      // 新しい履歴を含めてすべてのパスを再描画
      newHistory.forEach(path => {
        drawPath(ctx, path);
      });
    }

    // 状態をクリア
    setIsEditingText(false);
    setTextInput('');
    setTextPosition(null);
  };

  // テキスト入力のキーボードイベント
  useEffect(() => {
    if (isEditingText) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleConfirmText();
        } else if (e.key === 'Escape') {
          setIsEditingText(false);
          setTextInput('');
          setTextPosition(null);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditingText, textInput, textPosition]);

  // 選択範囲を削除
  const handleDeleteSelection = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !selection) return;

    // Undo用に履歴を保存
    saveImageToHistory();

    // 選択範囲の座標を取得
    const x = Math.min(selection.startX, selection.endX);
    const y = Math.min(selection.startY, selection.endY);
    const width = Math.abs(selection.endX - selection.startX);
    const height = Math.abs(selection.endY - selection.startY);

    // 一時Canvasに点線を含まない状態を再構築
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx && imageRef.current) {
      // 元の画像を描画
      tempCtx.drawImage(imageRef.current, 0, 0);

      // 描画履歴を再描画
      history.forEach(path => {
        drawPath(tempCtx, path);
      });

      // 選択範囲を白で塗りつぶす
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.fillRect(x, y, width, height);
    }

    // 即座に選択範囲をクリアして再描画
    setSelection(null);
    if (tempCtx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tempCanvas, 0, 0);
    }

    // 画像参照を非同期で更新
    if (tempCtx) {
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        // 画像が読み込まれたら再描画
        if (ctx && imageRef.current) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(imageRef.current, 0, 0);
          history.forEach(path => {
            drawPath(ctx, path);
          });
        }
      };
      img.src = tempCanvas.toDataURL();
    }
  };

  // 選択範囲を確定（画像に貼り付け）
  const handleConfirmSelection = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !selection || !selection.imageData) return;

    // Undo用に履歴を保存（移動していない場合のみ）
    if (!selection.savedImageBeforeMove) {
      saveImageToHistory();
    }

    const x = Math.min(selection.startX, selection.endX);
    const y = Math.min(selection.startY, selection.endY);

    // 一時Canvasに点線を含まない状態を再構築
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx && imageRef.current) {
      // 元の画像を描画
      tempCtx.drawImage(imageRef.current, 0, 0);

      // 描画履歴を再描画
      history.forEach(path => {
        drawPath(tempCtx, path);
      });

      // 現在の位置に画像データを貼り付け
      tempCtx.putImageData(selection.imageData, x, y);
    }

    // 即座に選択範囲をクリアして再描画
    setSelection(null);
    if (tempCtx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tempCanvas, 0, 0);
    }

    // 画像参照を非同期で更新
    if (tempCtx) {
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        // 画像が読み込まれたら再描画
        if (ctx && imageRef.current) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(imageRef.current, 0, 0);
          history.forEach(path => {
            drawPath(ctx, path);
          });
        }
      };
      img.src = tempCanvas.toDataURL();
    }
  };

  // 選択範囲をクリップボードにコピー
  const handleCopySelection = useCallback(async () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !selection || !selection.imageData) return;

    try {
      // 選択範囲の画像データを一時Canvasに描画
      const width = Math.abs(selection.endX - selection.startX);
      const height = Math.abs(selection.endY - selection.startY);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');

      if (!tempCtx) return;

      tempCtx.putImageData(selection.imageData, 0, 0);

      // Blobに変換してクリップボードに書き込み
      const blob = await new Promise<Blob>((resolve, reject) => {
        tempCanvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/png');
      });

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);

      console.log('Image copied to clipboard');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      alert('クリップボードへのコピーに失敗しました。ブラウザの権限を確認してください。');
    }
  }, [selection]);

  // クリップボードから画像を貼り付け
  const handlePaste = useCallback(async () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    try {
      const clipboardItems = await navigator.clipboard.read();

      for (const item of clipboardItems) {
        // 画像タイプを探す
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (!imageType) continue;

        const blob = await item.getType(imageType);
        const img = new Image();

        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            // 画像を一時Canvasに描画してImageDataを取得
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            const tempCtx = tempCanvas.getContext('2d');

            if (!tempCtx) {
              reject(new Error('Failed to get context'));
              return;
            }

            tempCtx.drawImage(img, 0, 0);
            const imageData = tempCtx.getImageData(0, 0, img.width, img.height);

            // 既存の選択をクリア
            setSelection(null);

            // 貼り付け画像を設定（中央に配置）
            const x = Math.max(0, Math.floor((canvas.width - img.width) / 2));
            const y = Math.max(0, Math.floor((canvas.height - img.height) / 2));

            setPastedImage({ imageData, x, y });

            // 選択モードに切り替え
            setDrawingMode('select');

            resolve();
          };
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = URL.createObjectURL(blob);
        });

        break; // 最初の画像のみ処理
      }
    } catch (error) {
      console.error('Failed to paste from clipboard:', error);
      // クリップボードに画像がない場合は静かに無視
    }
  }, []);

  // 貼り付け画像の描画
  const drawPastedImageOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !pastedImage) return;

    // 画像を描画
    ctx.putImageData(pastedImage.imageData, pastedImage.x, pastedImage.y);

    // 選択範囲の枠線を描画（点線）
    ctx.strokeStyle = '#1976d2';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(pastedImage.x, pastedImage.y, pastedImage.imageData.width, pastedImage.imageData.height);
    ctx.setLineDash([]);

    // コーナーのハンドルを描画
    ctx.fillStyle = '#1976d2';
    const handleSize = 8;
    const corners = [
      { x: pastedImage.x, y: pastedImage.y },
      { x: pastedImage.x + pastedImage.imageData.width, y: pastedImage.y },
      { x: pastedImage.x, y: pastedImage.y + pastedImage.imageData.height },
      { x: pastedImage.x + pastedImage.imageData.width, y: pastedImage.y + pastedImage.imageData.height },
    ];
    corners.forEach(corner => {
      ctx.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
    });
  }, [pastedImage]);

  // 貼り付け画像の確定
  const handleConfirmPasted = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !pastedImage) return;

    // Undo用に履歴を保存
    saveImageToHistory();

    // 一時Canvasに現在の状態を構築
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    if (tempCtx && imageRef.current) {
      tempCtx.drawImage(imageRef.current, 0, 0);
      history.forEach(path => drawPath(tempCtx, path));
      tempCtx.putImageData(pastedImage.imageData, pastedImage.x, pastedImage.y);

      // 画像参照を更新
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        setPastedImage(null);
        redrawCanvas();
      };
      img.src = tempCanvas.toDataURL();
    }
  }, [pastedImage, history]);

  // 貼り付けをキャンセル
  const handleCancelPasted = useCallback(() => {
    setPastedImage(null);
    redrawCanvas();
  }, []);

  // 貼り付け画像内かチェック
  const isInsidePastedImage = (x: number, y: number) => {
    if (!pastedImage) return false;
    return x >= pastedImage.x &&
           x <= pastedImage.x + pastedImage.imageData.width &&
           y >= pastedImage.y &&
           y <= pastedImage.y + pastedImage.imageData.height;
  };

  // 選択をキャンセル
  const handleCancelSelection = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !selection) return;

    // 移動開始前の画像を取得（setSelection前に）
    const savedImage = selection.savedImageBeforeMove;

    // 選択範囲をクリア（再描画の前に）
    setSelection(null);

    // 移動開始前の画像が保存されている場合は復元
    if (savedImage) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(savedImage, 0, 0);
      imageRef.current = savedImage;
    }

    // 即座にCanvasをクリアして画像と履歴のみを再描画（選択範囲なし）
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (imageRef.current) {
      ctx.drawImage(imageRef.current, 0, 0);
    }

    // すべてのパスを再描画
    history.forEach(path => {
      drawPath(ctx, path);
    });
  };

  // キーボードイベントを処理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+C で選択範囲をコピー
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selection && selection.imageData) {
        e.preventDefault();
        handleCopySelection();
      }
      // Ctrl+V でクリップボードから貼り付け
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        handlePaste();
      }
      // Deleteキーで選択範囲を削除
      if (e.key === 'Delete' && selection && drawingMode === 'select') {
        handleDeleteSelection();
      }
      // Enterキーで選択範囲または貼り付け画像を確定
      if (e.key === 'Enter' && drawingMode === 'select') {
        if (pastedImage) {
          handleConfirmPasted();
        } else if (selection) {
          handleConfirmSelection();
        }
      }
      // Escapeキーで選択または貼り付けをキャンセル
      if (e.key === 'Escape') {
        if (pastedImage) {
          handleCancelPasted();
        } else if (selection) {
          handleCancelSelection();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, drawingMode, pastedImage, handleCopySelection, handlePaste, handleConfirmPasted, handleCancelPasted]);

  // 元に戻す
  const handleUndo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // 画像履歴がある場合は、画像を復元
    if (imageHistory.length > 0) {
      const previousImage = imageHistory[imageHistory.length - 1];
      const newImageHistory = imageHistory.slice(0, -1);
      setImageHistory(newImageHistory);

      // 選択範囲をクリア
      setSelection(null);

      // 画像を復元
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(previousImage, 0, 0);
      imageRef.current = previousImage;

      // 即座に再描画
      redrawCanvas();

      // さらに次のフレームでも再描画（確実に反映させるため）
      requestAnimationFrame(() => {
        redrawCanvas();
      });

      // redrawTriggerも更新（念のため）
      setRedrawTrigger(prev => prev + 1);
      return;
    }

    // 描画履歴がある場合は、パスを削除
    if (history.length === 0) return;
    const newHistory = history.slice(0, -1);
    setHistory(newHistory);

    // 即座にCanvasに再描画（新しい履歴を使って）
    if (imageRef.current) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imageRef.current, 0, 0);

      // 新しい履歴を使ってすべてのパスを再描画
      newHistory.forEach(path => {
        drawPath(ctx, path);
      });
    }
  };

  // 保存
  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) return;

    if (!onSave && !disableDefaultSave) {
      alert('保存処理が設定されていません');
      return;
    }

    setSaving(true);
    try {
      // 一時Canvasを作成して点線を含まない状態を生成
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');

      if (!tempCtx) {
        throw new Error('Failed to get 2d context');
      }

      // 元の画像を描画
      tempCtx.drawImage(imageRef.current, 0, 0);

      // 描画履歴を再描画
      history.forEach(path => {
        drawPath(tempCtx, path);
      });

      // 選択範囲がドラッグ中の場合は、画像データを現在位置に貼り付け
      if (selection && isDraggingSelection && selection.imageData) {
        const x = Math.min(selection.startX, selection.endX);
        const y = Math.min(selection.startY, selection.endY);
        tempCtx.putImageData(selection.imageData, x, y);
      }

      // 一時Canvasからblobを作成（点線は含まれない）
      const blob = await new Promise<Blob>((resolve, reject) => {
        tempCanvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/png');
      });

      // 保存モード選択が有効な場合はダイアログを表示
      if (enableSaveModeSelection) {
        setPendingSaveBlob(blob);
        setSaveModeDialogOpen(true);
        setSaving(false);
      } else {
        // デフォルトは上書き保存
        if (onSave) {
          await onSave(blob, 'overwrite');
        }
        setSaving(false);
      }
    } catch (error) {
      console.error('Failed to save image:', error);
      alert('画像の保存に失敗しました');
      setSaving(false);
    }
  };

  // 保存モード確定後の処理
  const handleConfirmSaveMode = async (mode: 'overwrite' | 'new') => {
    if (!pendingSaveBlob || !onSave) return;

    setSaveModeDialogOpen(false);
    setSaving(true);
    try {
      await onSave(pendingSaveBlob, mode);
    } catch (error) {
      console.error('Failed to save image:', error);
      alert('画像の保存に失敗しました');
    } finally {
      setSaving(false);
      setPendingSaveBlob(null);
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
          {selection && selection.imageData && drawingMode === 'select' && (
            <Box sx={{ display: 'flex', gap: 1, borderLeft: '1px solid #ddd', pl: 2, ml: 2 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<ContentCopy />}
                onClick={handleCopySelection}
                title="Ctrl+C"
              >
                コピー
              </Button>
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

          {/* 貼り付け画像の操作ボタン */}
          {pastedImage && drawingMode === 'select' && (
            <Box sx={{ display: 'flex', gap: 1, borderLeft: '1px solid #ddd', pl: 2, ml: 2 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleConfirmPasted}
              >
                確定 (Enter)
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleCancelPasted}
              >
                キャンセル (Esc)
              </Button>
            </Box>
          )}

          {/* 貼り付けボタン（選択モード時） */}
          {drawingMode === 'select' && !selection && !pastedImage && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<ContentPaste />}
              onClick={handlePaste}
              title="Ctrl+V"
            >
              貼り付け
            </Button>
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
              disabled={history.length === 0 && imageHistory.length === 0}
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
          position: 'relative',
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

        {/* Canvas上でのテキスト入力（画像に重ねて直接表示） */}
        {isEditingText && textPosition && canvasRef.current && (
          <>
            {/* 点線の入力エリア */}
            <Box
              sx={{
                position: 'fixed',
                left: textPosition.x,
                top: textPosition.y,
                border: '2px dashed #1976d2',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                minWidth: 200,
                minHeight: textConfig.fontSize * displayScale * 1.5,
                pointerEvents: 'none',
                zIndex: 999,
              }}
            />
            {/* 透明なテキスト入力フィールド */}
            <TextField
              inputRef={textInputRef}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="テキストを入力..."
              multiline
              autoFocus
              variant="standard"
              sx={{
                position: 'fixed',
                left: textPosition.x,
                top: textPosition.y,
                zIndex: 1000,
                '& .MuiInput-root': {
                  '&:before, &:after': {
                    display: 'none',
                  },
                },
                '& .MuiInputBase-input': {
                  fontSize: `${textConfig.fontSize * displayScale}px`,  // スケールを適用
                  fontWeight: textConfig.fontWeight,
                  fontStyle: textConfig.fontStyle,
                  color: color,
                  padding: 0,
                  backgroundColor: 'transparent',
                  minWidth: 200,
                  lineHeight: 1.2,
                  '&::placeholder': {
                    color: 'rgba(0, 0, 0, 0.3)',
                    opacity: 1,
                  },
                },
              }}
            />
            {/* フローティングツールバー（入力エリアの上に表示） */}
            <Paper
              sx={{
                position: 'fixed',
                left: textPosition.x,
                top: textPosition.y - 60,
                zIndex: 1001,
                p: 1,
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="caption">サイズ:</Typography>
                <Slider
                  value={textConfig.fontSize}
                  onChange={(_, value) => setTextConfig({ ...textConfig, fontSize: value as number })}
                  min={12}
                  max={120}
                  size="small"
                  sx={{ width: 100 }}
                />
                <Typography variant="caption" sx={{ minWidth: 30 }}>{textConfig.fontSize}</Typography>
              </Box>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={textConfig.fontWeight}
                onChange={(_, value) => value && setTextConfig({ ...textConfig, fontWeight: value })}
              >
                <ToggleButton value="normal">標準</ToggleButton>
                <ToggleButton value="bold">太字</ToggleButton>
              </ToggleButtonGroup>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={textConfig.fontStyle}
                onChange={(_, value) => value && setTextConfig({ ...textConfig, fontStyle: value })}
              >
                <ToggleButton value="normal">標準</ToggleButton>
                <ToggleButton value="italic">斜体</ToggleButton>
              </ToggleButtonGroup>
              <Button size="small" onClick={() => { setIsEditingText(false); setTextInput(''); }}>
                キャンセル
              </Button>
              <Button size="small" variant="contained" onClick={handleConfirmText}>
                確定
              </Button>
            </Paper>
          </>
        )}
      </Box>

      {/* 保存モード選択ダイアログ */}
      <Dialog
        open={saveModeDialogOpen}
        onClose={() => {
          setSaveModeDialogOpen(false);
          setPendingSaveBlob(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>保存方法を選択</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            編集した画像をどのように保存しますか？
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              variant="outlined"
              size="large"
              startIcon={<Save />}
              onClick={() => handleConfirmSaveMode('overwrite')}
              sx={{ justifyContent: 'flex-start', py: 2 }}
            >
              <Box sx={{ textAlign: 'left', flex: 1 }}>
                <Typography variant="body1" fontWeight="bold">
                  上書き保存
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  元の画像を編集後の画像で置き換えます
                </Typography>
              </Box>
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<FileCopy />}
              onClick={() => handleConfirmSaveMode('new')}
              sx={{ justifyContent: 'flex-start', py: 2 }}
            >
              <Box sx={{ textAlign: 'left', flex: 1 }}>
                <Typography variant="body1" fontWeight="bold">
                  新規保存
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  元の画像を残したまま、新しい素材として保存します
                </Typography>
              </Box>
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setSaveModeDialogOpen(false);
              setPendingSaveBlob(null);
            }}
          >
            キャンセル
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
