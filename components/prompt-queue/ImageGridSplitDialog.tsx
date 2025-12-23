'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Grid,
  CircularProgress,
  IconButton,
  Checkbox,
} from '@mui/material';
import {
  GridOn as GridIcon,
  Close as CloseIcon,
  AutoFixHigh as AutoIcon,
} from '@mui/icons-material';

// プリセット設定
interface GridPreset {
  label: string;
  rows: number;
  cols: number;
  description: string;
}

interface SplitImage {
  index: number;
  row: number;
  col: number;
  dataUrl: string;
  selected: boolean;
}

interface ImageGridSplitDialogProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  imageName: string;
  onSelectSplitImages: (images: { dataUrl: string; name: string }[]) => void;
  maxSelections: number;
}

export default function ImageGridSplitDialog({
  open,
  onClose,
  imageUrl,
  imageName,
  onSelectSplitImages,
  maxSelections,
}: ImageGridSplitDialogProps) {
  const [rows, setRows] = useState(5);
  const [cols, setCols] = useState(5);
  const [splitImages, setSplitImages] = useState<SplitImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // 画像サイズに基づいてプリセットを計算
  const getPresets = useCallback((): GridPreset[] => {
    if (!imageSize) return [];

    const { width, height } = imageSize;
    const aspectRatio = width / height;
    const presets: GridPreset[] = [];

    // 正方形に近い場合
    if (aspectRatio >= 0.8 && aspectRatio <= 1.25) {
      presets.push(
        { label: '2×2', rows: 2, cols: 2, description: '4枚' },
        { label: '3×3', rows: 3, cols: 3, description: '9枚' },
        { label: '4×4', rows: 4, cols: 4, description: '16枚' },
      );
    }
    // 横長の場合
    else if (aspectRatio > 1.25) {
      if (aspectRatio >= 1.7) {
        // 16:9 など非常に横長
        presets.push(
          { label: '1×2', rows: 1, cols: 2, description: '2枚（横2等分）' },
          { label: '1×3', rows: 1, cols: 3, description: '3枚（横3等分）' },
          { label: '1×4', rows: 1, cols: 4, description: '4枚（横4等分）' },
          { label: '2×4', rows: 2, cols: 4, description: '8枚' },
          { label: '2×5', rows: 2, cols: 5, description: '10枚' },
        );
      } else {
        // 4:3 など軽い横長
        presets.push(
          { label: '2×3', rows: 2, cols: 3, description: '6枚' },
          { label: '2×4', rows: 2, cols: 4, description: '8枚' },
          { label: '3×4', rows: 3, cols: 4, description: '12枚' },
        );
      }
    }
    // 縦長の場合
    else {
      if (aspectRatio <= 0.6) {
        // 9:16 など非常に縦長
        presets.push(
          { label: '2×1', rows: 2, cols: 1, description: '2枚（縦2等分）' },
          { label: '3×1', rows: 3, cols: 1, description: '3枚（縦3等分）' },
          { label: '4×1', rows: 4, cols: 1, description: '4枚（縦4等分）' },
          { label: '4×2', rows: 4, cols: 2, description: '8枚' },
          { label: '5×2', rows: 5, cols: 2, description: '10枚' },
        );
      } else {
        // 3:4 など軽い縦長
        presets.push(
          { label: '3×2', rows: 3, cols: 2, description: '6枚' },
          { label: '4×2', rows: 4, cols: 2, description: '8枚' },
          { label: '4×3', rows: 4, cols: 3, description: '12枚' },
        );
      }
    }

    return presets;
  }, [imageSize]);

  // 画像サイズに基づいて自動で最適な分割を設定
  const handleAutoSplit = useCallback(() => {
    if (!imageSize) return;

    const { width, height } = imageSize;
    const aspectRatio = width / height;

    // アスペクト比に基づいて適切な分割数を決定
    if (aspectRatio >= 0.8 && aspectRatio <= 1.25) {
      // 正方形に近い: 2×2
      setRows(2);
      setCols(2);
    } else if (aspectRatio > 1.25) {
      // 横長
      if (aspectRatio >= 2) {
        // 非常に横長: 1×4 または 2×4
        setRows(1);
        setCols(4);
      } else if (aspectRatio >= 1.5) {
        // 横長: 2×3
        setRows(2);
        setCols(3);
      } else {
        // 軽い横長: 2×3
        setRows(2);
        setCols(3);
      }
    } else {
      // 縦長
      if (aspectRatio <= 0.5) {
        // 非常に縦長: 4×1 または 4×2
        setRows(4);
        setCols(1);
      } else if (aspectRatio <= 0.67) {
        // 縦長: 3×2
        setRows(3);
        setCols(2);
      } else {
        // 軽い縦長: 3×2
        setRows(3);
        setCols(2);
      }
    }
  }, [imageSize]);

  // ダイアログが開いたときに画像を読み込む
  useEffect(() => {
    if (open && imageUrl) {
      setLoading(true);
      setImageLoaded(false);
      setSplitImages([]);
      setImageSize(null);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageRef.current = img;
        setImageSize({ width: img.width, height: img.height });
        setImageLoaded(true);
        setLoading(false);
      };
      img.onerror = () => {
        console.error('Failed to load image:', imageUrl);
        setLoading(false);
      };
      img.src = imageUrl;
    }
  }, [open, imageUrl]);

  // 行数・列数が変更されたら、または画像が読み込まれたら分割画像を生成
  useEffect(() => {
    if (imageLoaded && imageRef.current) {
      generateSplitImages();
    }
  }, [imageLoaded, rows, cols]);

  const generateSplitImages = useCallback(() => {
    const img = imageRef.current;
    if (!img) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const images: SplitImage[] = [];
    const cellWidth = Math.floor(img.width / cols);
    const cellHeight = Math.floor(img.height / rows);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // 各セルを描画
        canvas.width = cellWidth;
        canvas.height = cellHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        ctx.drawImage(
          img,
          col * cellWidth,
          row * cellHeight,
          cellWidth,
          cellHeight,
          0,
          0,
          cellWidth,
          cellHeight
        );

        const dataUrl = canvas.toDataURL('image/png');
        images.push({
          index: row * cols + col,
          row,
          col,
          dataUrl,
          selected: false,
        });
      }
    }

    setSplitImages(images);
  }, [rows, cols]);

  const handleToggleImage = (index: number) => {
    setSplitImages((prev) => {
      const selectedCount = prev.filter((img) => img.selected).length;
      const targetImage = prev.find((img) => img.index === index);

      if (!targetImage) return prev;

      // 既に選択されている場合は解除
      if (targetImage.selected) {
        return prev.map((img) =>
          img.index === index ? { ...img, selected: false } : img
        );
      }

      // 最大選択数に達している場合は追加しない
      if (selectedCount >= maxSelections) {
        return prev;
      }

      return prev.map((img) =>
        img.index === index ? { ...img, selected: true } : img
      );
    });
  };

  const handleSelectAll = () => {
    setSplitImages((prev) => {
      const availableCount = Math.min(prev.length, maxSelections);
      return prev.map((img, idx) => ({
        ...img,
        selected: idx < availableCount,
      }));
    });
  };

  const handleDeselectAll = () => {
    setSplitImages((prev) =>
      prev.map((img) => ({ ...img, selected: false }))
    );
  };

  const handleConfirm = () => {
    const selectedImages = splitImages
      .filter((img) => img.selected)
      .map((img) => ({
        dataUrl: img.dataUrl,
        name: `${imageName}_${img.row + 1}-${img.col + 1}`,
      }));
    onSelectSplitImages(selectedImages);
    onClose();
  };

  const selectedCount = splitImages.filter((img) => img.selected).length;

  // 切り出しセルのアスペクト比を計算
  const cellAspectRatio = imageSize
    ? (imageSize.width / cols) / (imageSize.height / rows)
    : 1;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GridIcon />
            <Typography variant="h6">画像を等分切り出し</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 画像サイズ情報 */}
          {imageSize && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary">
                画像サイズ: {imageSize.width} × {imageSize.height}px
                （{imageSize.width > imageSize.height ? '横長' : imageSize.width < imageSize.height ? '縦長' : '正方形'}）
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AutoIcon />}
                onClick={handleAutoSplit}
              >
                自動設定
              </Button>
            </Box>
          )}

          {/* プリセットボタン */}
          {imageSize && getPresets().length > 0 && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                おすすめ:
              </Typography>
              {getPresets().map((preset) => (
                <Button
                  key={preset.label}
                  size="small"
                  variant={rows === preset.rows && cols === preset.cols ? 'contained' : 'outlined'}
                  onClick={() => {
                    setRows(preset.rows);
                    setCols(preset.cols);
                  }}
                  sx={{ minWidth: 'auto', px: 1.5 }}
                >
                  {preset.label}
                </Button>
              ))}
            </Box>
          )}

          {/* グリッド設定 */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              label="縦（行）"
              type="number"
              value={rows}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (value >= 1 && value <= 10) {
                  setRows(value);
                }
              }}
              inputProps={{ min: 1, max: 10 }}
              size="small"
              sx={{ width: 100 }}
            />
            <Typography variant="body1">×</Typography>
            <TextField
              label="横（列）"
              type="number"
              value={cols}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (value >= 1 && value <= 10) {
                  setCols(value);
                }
              }}
              inputProps={{ min: 1, max: 10 }}
              size="small"
              sx={{ width: 100 }}
            />
            <Typography variant="body2" color="text.secondary">
              = {rows * cols} 枚
              {imageSize && (
                <span style={{ marginLeft: 8 }}>
                  （各 {Math.floor(imageSize.width / cols)} × {Math.floor(imageSize.height / rows)} px）
                </span>
              )}
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Button size="small" variant="outlined" onClick={handleSelectAll}>
              全選択
            </Button>
            <Button size="small" variant="outlined" onClick={handleDeselectAll}>
              全解除
            </Button>
          </Box>

          {/* プレビュー & 選択 */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 2 }}>
              {/* 元画像プレビュー */}
              <Box sx={{ flex: '0 0 200px' }}>
                <Typography variant="subtitle2" gutterBottom>
                  元画像
                </Typography>
                <Box
                  sx={{
                    position: 'relative',
                    width: 200,
                    height: 200,
                    bgcolor: 'grey.100',
                    borderRadius: 1,
                    overflow: 'hidden',
                  }}
                >
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt={imageName}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  )}
                  {/* グリッド線のオーバーレイ */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'grid',
                      gridTemplateColumns: `repeat(${cols}, 1fr)`,
                      gridTemplateRows: `repeat(${rows}, 1fr)`,
                      pointerEvents: 'none',
                    }}
                  >
                    {Array.from({ length: rows * cols }).map((_, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          border: '1px dashed rgba(255, 255, 255, 0.5)',
                          boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.2)',
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              </Box>

              {/* 分割画像グリッド */}
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  切り出し画像（{selectedCount}/{maxSelections}枚選択中）
                </Typography>
                <Grid container spacing={1}>
                  {splitImages.map((img) => {
                    const disabled = !img.selected && selectedCount >= maxSelections;
                    return (
                      <Grid
                        size={{ xs: 12 / Math.min(cols, 6) }}
                        key={img.index}
                      >
                        <Box
                          onClick={() => !disabled && handleToggleImage(img.index)}
                          sx={{
                            position: 'relative',
                            aspectRatio: `${cellAspectRatio}`,
                            borderRadius: 1,
                            overflow: 'hidden',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            opacity: disabled ? 0.5 : 1,
                            border: img.selected
                              ? '3px solid #1976d2'
                              : '1px solid #ddd',
                            '&:hover': disabled
                              ? {}
                              : { borderColor: '#1976d2' },
                          }}
                        >
                          <img
                            src={img.dataUrl}
                            alt={`${img.row + 1}-${img.col + 1}`}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                            }}
                          />
                          <Checkbox
                            checked={img.selected}
                            disabled={disabled}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!disabled) {
                                handleToggleImage(img.index);
                              }
                            }}
                            sx={{
                              position: 'absolute',
                              top: 0,
                              right: 0,
                              bgcolor: 'rgba(255,255,255,0.8)',
                              borderRadius: '0 0 0 4px',
                              padding: '2px',
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              bgcolor: 'rgba(0,0,0,0.6)',
                              color: 'white',
                              textAlign: 'center',
                              py: 0.25,
                              fontSize: 10,
                            }}
                          >
                            {img.row + 1}-{img.col + 1}
                          </Typography>
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            </Box>
          )}

          {/* 非表示のCanvas（画像処理用） */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={selectedCount === 0}
        >
          {selectedCount}枚を追加
        </Button>
      </DialogActions>
    </Dialog>
  );
}
