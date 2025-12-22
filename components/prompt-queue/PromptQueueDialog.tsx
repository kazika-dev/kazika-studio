'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Typography,
  Box,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Image as ImageIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import type {
  PromptQueueWithImages,
  CreatePromptQueueRequest,
  UpdatePromptQueueRequest,
  PromptQueueImageType,
} from '@/types/prompt-queue';
import ImageSelectorDialog from './ImageSelectorDialog';
import { getSignedImageUrl } from '@/lib/utils/imageUrl';

interface PromptQueueDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreatePromptQueueRequest | UpdatePromptQueueRequest) => Promise<void>;
  editQueue?: PromptQueueWithImages | null;
}

const ASPECT_RATIO_OPTIONS = [
  { value: '1:1', label: '1:1 (正方形)' },
  { value: '16:9', label: '16:9 (横長)' },
  { value: '9:16', label: '9:16 (縦長)' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '3:2', label: '3:2' },
  { value: '2:3', label: '2:3' },
];

const MODEL_OPTIONS = [
  { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image (推奨)' },
  { value: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image Preview (高品質)' },
];

interface SelectedImage {
  image_type: PromptQueueImageType;
  reference_id: number;
  name?: string;
  image_url?: string;
}

export default function PromptQueueDialog({
  open,
  onClose,
  onSave,
  editQueue,
}: PromptQueueDialogProps) {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [model, setModel] = useState('gemini-2.5-flash-image');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [priority, setPriority] = useState(0);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false);
  const [imageSelectorType, setImageSelectorType] = useState<'character_sheet' | 'output'>('character_sheet');

  // 編集モードの場合は値を設定
  useEffect(() => {
    if (editQueue) {
      setName(editQueue.name || '');
      setPrompt(editQueue.prompt);
      setNegativePrompt(editQueue.negative_prompt || '');
      setModel(editQueue.model);
      setAspectRatio(editQueue.aspect_ratio);
      setPriority(editQueue.priority);
      setSelectedImages(
        editQueue.images.map((img) => ({
          image_type: img.image_type,
          reference_id: img.reference_id,
          name: img.name || undefined,
          image_url: img.image_url || undefined,
        }))
      );
    } else {
      // 新規作成時はリセット
      setName('');
      setPrompt('');
      setNegativePrompt('');
      setModel('gemini-2.5-flash-image');
      setAspectRatio('16:9');
      setPriority(0);
      setSelectedImages([]);
    }
  }, [editQueue, open]);

  // 画像URLを読み込み
  useEffect(() => {
    const loadUrls = async () => {
      for (const img of selectedImages) {
        const key = `${img.image_type}:${img.reference_id}`;
        if (img.image_url && !imageUrls[key]) {
          try {
            const url = await getSignedImageUrl(img.image_url);
            setImageUrls((prev) => ({ ...prev, [key]: url }));
          } catch (error) {
            console.error('Failed to load image URL:', error);
          }
        }
      }
    };
    loadUrls();
  }, [selectedImages]);

  const handleSave = async () => {
    if (!prompt.trim()) return;

    setSaving(true);
    try {
      await onSave({
        name: name || undefined,
        prompt,
        negative_prompt: negativePrompt || undefined,
        model,
        aspect_ratio: aspectRatio,
        priority,
        images: selectedImages.map((img) => ({
          image_type: img.image_type,
          reference_id: img.reference_id,
        })),
      });
      onClose();
    } catch (error) {
      console.error('Failed to save queue:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOpenImageSelector = (type: 'character_sheet' | 'output') => {
    setImageSelectorType(type);
    setImageSelectorOpen(true);
  };

  const handleSelectImages = (images: SelectedImage[]) => {
    // 既存の選択に追加（最大8枚まで）
    setSelectedImages((prev) => {
      const newImages = [...prev];
      for (const img of images) {
        // 重複チェック
        const exists = newImages.some(
          (existing) =>
            existing.image_type === img.image_type && existing.reference_id === img.reference_id
        );
        if (!exists && newImages.length < 8) {
          newImages.push(img);
        }
      }
      return newImages;
    });
    setImageSelectorOpen(false);
  };

  const remainingSlots = 8 - selectedImages.length;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {editQueue ? 'プロンプトキューを編集' : 'プロンプトキューを作成'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* キュー名 */}
            <TextField
              label="キュー名（任意）"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              size="small"
            />

            {/* プロンプト */}
            <TextField
              label="プロンプト"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              fullWidth
              multiline
              rows={4}
              required
              error={!prompt.trim()}
              helperText={!prompt.trim() ? 'プロンプトは必須です' : ''}
            />

            {/* ネガティブプロンプト */}
            <TextField
              label="ネガティブプロンプト"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />

            {/* モデル・アスペクト比 */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>モデル</InputLabel>
                <Select value={model} label="モデル" onChange={(e) => setModel(e.target.value)}>
                  {MODEL_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel>アスペクト比</InputLabel>
                <Select
                  value={aspectRatio}
                  label="アスペクト比"
                  onChange={(e) => setAspectRatio(e.target.value)}
                >
                  {ASPECT_RATIO_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* 優先度 */}
            <Box>
              <Typography variant="body2" gutterBottom>
                優先度: {priority}
              </Typography>
              <Slider
                value={priority}
                onChange={(_, value) => setPriority(value as number)}
                min={0}
                max={10}
                marks
                valueLabelDisplay="auto"
              />
            </Box>

            {/* 参照画像 */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                参照画像（{selectedImages.length}/8枚）
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<PersonIcon />}
                  onClick={() => handleOpenImageSelector('character_sheet')}
                  disabled={remainingSlots === 0}
                  size="small"
                >
                  キャラクターシートから選択
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ImageIcon />}
                  onClick={() => handleOpenImageSelector('output')}
                  disabled={remainingSlots === 0}
                  size="small"
                >
                  アウトプットから選択
                </Button>
              </Box>

              {/* 選択済み画像 */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {selectedImages.map((img, index) => {
                  const key = `${img.image_type}:${img.reference_id}`;
                  const url = imageUrls[key];

                  return (
                    <Tooltip
                      key={key}
                      title={
                        img.name ||
                        (img.image_type === 'character_sheet' ? 'キャラクターシート' : 'アウトプット')
                      }
                    >
                      <Box
                        sx={{
                          position: 'relative',
                          width: 64,
                          height: 64,
                          borderRadius: 1,
                          overflow: 'hidden',
                          bgcolor: 'grey.200',
                          border:
                            img.image_type === 'character_sheet'
                              ? '2px solid #1976d2'
                              : '2px solid #9c27b0',
                        }}
                      >
                        {url ? (
                          <img
                            src={url}
                            alt={img.name || '参照画像'}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <ImageIcon sx={{ color: 'grey.400' }} />
                          </Box>
                        )}
                        <IconButton
                          size="small"
                          sx={{
                            position: 'absolute',
                            top: -8,
                            right: -8,
                            bgcolor: 'error.main',
                            color: 'white',
                            '&:hover': { bgcolor: 'error.dark' },
                            width: 20,
                            height: 20,
                          }}
                          onClick={() => handleRemoveImage(index)}
                        >
                          <CloseIcon sx={{ fontSize: 14 }} />
                        </IconButton>
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
                            fontSize: 10,
                          }}
                        >
                          {img.image_type === 'character_sheet' ? 'CS' : 'OUT'}
                        </Typography>
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!prompt.trim() || saving}
            startIcon={saving ? <CircularProgress size={16} /> : undefined}
          >
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 画像選択ダイアログ */}
      <ImageSelectorDialog
        open={imageSelectorOpen}
        onClose={() => setImageSelectorOpen(false)}
        onSelect={handleSelectImages}
        type={imageSelectorType}
        maxSelections={remainingSlots}
        currentSelections={selectedImages}
      />
    </>
  );
}
