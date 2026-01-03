'use client';

import { useState } from 'react';
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
  Typography,
  Box,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Slider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Image as ImageIcon,
  AutoAwesome as GenerateIcon,
} from '@mui/icons-material';
import type { PromptQueueImageType } from '@/types/prompt-queue';
import ImageSelectorDialog from './ImageSelectorDialog';
import { GEMINI_MODEL_OPTIONS } from '@/lib/gemini/constants';

/**
 * 画像URLを取得（GCP Storageパスの場合はAPIエンドポイント経由）
 */
function getImageUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `/api/storage/${url}`;
}

interface SelectedImage {
  image_type: PromptQueueImageType;
  reference_id: number;
  name?: string;
  image_url?: string;
}

interface BulkGenerateDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
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

const IMAGE_MODEL_OPTIONS = [
  { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image (推奨)' },
  { value: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image Preview (高品質)' },
];

const LANGUAGE_OPTIONS = [
  { value: 'ja', label: '日本語' },
  { value: 'en', label: '英語 (English)' },
];

export default function BulkGenerateDialog({
  open,
  onClose,
  onSuccess,
}: BulkGenerateDialogProps) {
  const [theme, setTheme] = useState('');
  const [count, setCount] = useState(5);
  const [language, setLanguage] = useState<'ja' | 'en'>('ja');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [imageModel, setImageModel] = useState('gemini-2.5-flash-image');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    generated: number;
    created: number;
    failed: number;
  } | null>(null);

  const handleGenerate = async () => {
    if (!theme.trim()) return;

    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/prompt-queue/bulk-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme,
          count,
          language,
          model,
          imageModel,
          aspectRatio,
          negativePrompt: negativePrompt || undefined,
          images: selectedImages.length > 0
            ? selectedImages.map((img) => ({
                image_type: img.image_type,
                reference_id:
                  typeof img.reference_id === 'string'
                    ? parseInt(img.reference_id, 10)
                    : img.reference_id,
              }))
            : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'プロンプト生成に失敗しました');
      }

      const data = await response.json();
      setResult({
        generated: data.generated,
        created: data.created,
        failed: data.failed,
      });

      // 成功した場合、親コンポーネントに通知
      if (data.created > 0) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleClose = () => {
    // リセット
    setTheme('');
    setCount(5);
    setLanguage('ja');
    setModel('gemini-2.5-flash');
    setImageModel('gemini-2.5-flash-image');
    setAspectRatio('16:9');
    setNegativePrompt('');
    setSelectedImages([]);
    setError(null);
    setResult(null);
    onClose();
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSelectImages = (images: SelectedImage[]) => {
    setSelectedImages((prev) => {
      const newImages = [...prev];
      for (const img of images) {
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
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          一括プロンプト生成
          <Typography variant="body2" color="text.secondary">
            テーマを入力すると、AIが複数のプロンプトを自動生成してキューに登録します
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* エラー表示 */}
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* 結果表示 */}
            {result && (
              <Alert severity={result.failed > 0 ? 'warning' : 'success'}>
                {result.generated}個のプロンプトを生成し、{result.created}件のキューを作成しました
                {result.failed > 0 && `（${result.failed}件失敗）`}
              </Alert>
            )}

            {/* テーマ */}
            <TextField
              label="テーマ / 生成指示"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              fullWidth
              multiline
              rows={4}
              required
              error={!theme.trim()}
              helperText={
                !theme.trim()
                  ? 'テーマは必須です'
                  : '例: 「学園ラブコメのシーン集」「キャラクターの様々な表情」「季節ごとの風景」'
              }
              placeholder="どのようなプロンプトを生成したいか、テーマや指示を入力してください"
            />

            {/* 生成数 */}
            <Box>
              <Typography variant="body2" gutterBottom>
                生成数: {count}個
              </Typography>
              <Slider
                value={count}
                onChange={(_, value) => setCount(value as number)}
                min={1}
                max={20}
                marks={[
                  { value: 1, label: '1' },
                  { value: 5, label: '5' },
                  { value: 10, label: '10' },
                  { value: 20, label: '20' },
                ]}
                valueLabelDisplay="auto"
              />
            </Box>

            {/* 言語・AIモデル */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>出力言語</InputLabel>
                <Select
                  value={language}
                  label="出力言語"
                  onChange={(e) => setLanguage(e.target.value as 'ja' | 'en')}
                >
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel>生成AIモデル</InputLabel>
                <Select
                  value={model}
                  label="生成AIモデル"
                  onChange={(e) => setModel(e.target.value)}
                >
                  {GEMINI_MODEL_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* 画像生成モデル・アスペクト比 */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>画像生成モデル</InputLabel>
                <Select
                  value={imageModel}
                  label="画像生成モデル"
                  onChange={(e) => setImageModel(e.target.value)}
                >
                  {IMAGE_MODEL_OPTIONS.map((opt) => (
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

            {/* ネガティブプロンプト */}
            <TextField
              label="ネガティブプロンプト（共通）"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              fullWidth
              multiline
              rows={2}
              helperText="全てのキューに共通で適用されるネガティブプロンプト"
            />

            {/* 参照画像 */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                参照画像（共通）（{selectedImages.length}/8枚）
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                選択した画像は全てのキューに共通で適用されます
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<ImageIcon />}
                  onClick={() => setImageSelectorOpen(true)}
                  disabled={remainingSlots === 0}
                  size="small"
                >
                  画像を選択
                </Button>
              </Box>

              {/* 選択済み画像 */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {selectedImages.map((img, index) => {
                  const key = `${img.image_type}:${img.reference_id}`;
                  const url = getImageUrl(img.image_url);

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
          <Button onClick={handleClose}>閉じる</Button>
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={!theme.trim() || generating}
            startIcon={generating ? <CircularProgress size={16} /> : <GenerateIcon />}
          >
            {generating ? '生成中...' : `${count}個のプロンプトを生成`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 画像選択ダイアログ */}
      <ImageSelectorDialog
        open={imageSelectorOpen}
        onClose={() => setImageSelectorOpen(false)}
        onSelect={handleSelectImages}
        maxSelections={remainingSlots}
        currentSelections={selectedImages}
      />
    </>
  );
}
