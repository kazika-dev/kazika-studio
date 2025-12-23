'use client';

import { useState, useEffect, useRef } from 'react';
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
  Close as CloseIcon,
  Image as ImageIcon,
  LibraryBooks as LibraryBooksIcon,
  AutoFixHigh as EnhanceIcon,
} from '@mui/icons-material';
import type {
  PromptQueueWithImages,
  CreatePromptQueueRequest,
  UpdatePromptQueueRequest,
  PromptQueueImageType,
  PromptEnhanceMode,
  PromptQueueStatus,
} from '@/types/prompt-queue';
import ImageSelectorDialog from './ImageSelectorDialog';
import MasterSelectorDialog from './MasterSelectorDialog';

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

const STATUS_OPTIONS: { value: PromptQueueStatus; label: string; color: string }[] = [
  { value: 'pending', label: '待機中', color: '#757575' },
  { value: 'processing', label: '処理中', color: '#2196f3' },
  { value: 'completed', label: '完了', color: '#4caf50' },
  { value: 'failed', label: '失敗', color: '#f44336' },
  { value: 'cancelled', label: 'キャンセル', color: '#ff9800' },
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
  const [status, setStatus] = useState<PromptQueueStatus>('pending');
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false);
  const [masterSelectorOpen, setMasterSelectorOpen] = useState(false);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState<{ start: number; end: number } | null>(null);
  const [enhancePrompt, setEnhancePrompt] = useState<PromptEnhanceMode>('none');
  // プロンプト補完用の状態
  const [enhancedPrompt, setEnhancedPrompt] = useState<string>('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [useEnhancedPrompt, setUseEnhancedPrompt] = useState(false);

  // 編集モードの場合は値を設定
  useEffect(() => {
    if (editQueue) {
      // デバッグ: editQueueの内容を確認
      console.log('editQueue:', editQueue);
      console.log('editQueue.enhanced_prompt:', editQueue.enhanced_prompt);
      console.log('editQueue.enhance_prompt:', editQueue.enhance_prompt);

      setName(editQueue.name || '');
      setPrompt(editQueue.prompt);
      setNegativePrompt(editQueue.negative_prompt || '');
      setModel(editQueue.model);
      setAspectRatio(editQueue.aspect_ratio);
      setPriority(editQueue.priority);
      setStatus(editQueue.status);
      setSelectedImages(
        editQueue.images.map((img) => ({
          image_type: img.image_type,
          reference_id: img.reference_id,
          name: img.name || undefined,
          image_url: img.image_url || undefined,
        }))
      );
      // 補完済みプロンプトがあれば復元
      if (editQueue.enhanced_prompt) {
        console.log('Setting enhanced prompt:', editQueue.enhanced_prompt);
        setEnhancedPrompt(editQueue.enhanced_prompt);
        setUseEnhancedPrompt(true);  // 補完済みプロンプトがあれば使用する状態に
        setEnhancePrompt('enhance');  // enhanced_promptがあれば'enhance'に設定
      } else {
        console.log('No enhanced_prompt found');
        setEnhancedPrompt('');
        setUseEnhancedPrompt(false);
        setEnhancePrompt(editQueue.enhance_prompt || 'none');
      }
      setIsEnhancing(false);
    } else {
      // 新規作成時はリセット
      setName('');
      setPrompt('');
      setNegativePrompt('');
      setModel('gemini-2.5-flash-image');
      setAspectRatio('16:9');
      setPriority(0);
      setStatus('pending');
      setEnhancePrompt('none');
      setSelectedImages([]);
      // 補完関連の状態をリセット
      setEnhancedPrompt('');
      setUseEnhancedPrompt(false);
      setIsEnhancing(false);
    }
  }, [editQueue, open]);


  const handleSave = async () => {
    if (!prompt.trim()) return;

    setSaving(true);
    try {
      await onSave({
        name: name || undefined,
        prompt: prompt,  // 常に元のプロンプトを保存
        negative_prompt: negativePrompt || undefined,
        model,
        aspect_ratio: aspectRatio,
        priority,
        // 編集時のみステータスを送信
        ...(editQueue ? { status } : {}),
        // 補完を生成して使用する場合は 'enhance'、しない場合は 'none'
        enhance_prompt: useEnhancedPrompt && enhancedPrompt ? 'enhance' : 'none',
        // 補完後のプロンプトを直接enhanced_promptカラムに保存
        enhanced_prompt: useEnhancedPrompt && enhancedPrompt ? enhancedPrompt : null,
        images: selectedImages.length > 0
          ? selectedImages.map((img) => ({
              image_type: img.image_type,
              reference_id: typeof img.reference_id === 'string' ? parseInt(img.reference_id, 10) : img.reference_id,
            }))
          : undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save queue:', error);
    } finally {
      setSaving(false);
    }
  };

  // プロンプトを補完する
  const handleEnhancePrompt = async () => {
    if (!prompt.trim() || isEnhancing) return;

    setIsEnhancing(true);
    try {
      // 選択された画像のbase64データを収集
      const imageData: { mimeType: string; data: string }[] = [];

      for (const img of selectedImages) {
        if (img.image_url) {
          try {
            const url = getImageUrl(img.image_url);
            const response = await fetch(url);
            if (response.ok) {
              const blob = await response.blob();
              const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const result = reader.result as string;
                  // data:image/xxx;base64, の部分を除去
                  const base64Data = result.split(',')[1];
                  resolve(base64Data);
                };
                reader.readAsDataURL(blob);
              });
              imageData.push({
                mimeType: blob.type || 'image/png',
                data: base64,
              });
            }
          } catch (e) {
            console.error('Failed to load image for enhancement:', e);
          }
        }
      }

      // Gemini APIを呼び出してプロンプトを補完
      const response = await fetch('/api/prompt-queue/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          negative_prompt: negativePrompt || undefined,
          images: imageData.length > 0 ? imageData : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to enhance prompt');
      }

      const result = await response.json();
      setEnhancedPrompt(result.enhanced_prompt);
      setUseEnhancedPrompt(true);  // デフォルトで補完後を使用
    } catch (error) {
      console.error('Failed to enhance prompt:', error);
      alert('プロンプトの補完に失敗しました');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOpenImageSelector = () => {
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

  // マスター選択ダイアログを開く前にカーソル位置を保存
  const handleOpenMasterSelector = () => {
    const textarea = promptInputRef.current;
    if (textarea) {
      setCursorPosition({
        start: textarea.selectionStart ?? prompt.length,
        end: textarea.selectionEnd ?? prompt.length,
      });
    } else {
      setCursorPosition({ start: prompt.length, end: prompt.length });
    }
    setMasterSelectorOpen(true);
  };

  // マスターデータから選択したテキストをプロンプトの保存されたカーソル位置に挿入
  const handleMasterSelect = (text: string) => {
    const start = cursorPosition?.start ?? prompt.length;
    const end = cursorPosition?.end ?? prompt.length;
    const before = prompt.substring(0, start);
    const after = prompt.substring(end);
    // 前後にスペースを追加（必要な場合）
    const needSpaceBefore = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n');
    const needSpaceAfter = after.length > 0 && !after.startsWith(' ') && !after.startsWith('\n');
    const insertText = `${needSpaceBefore ? ' ' : ''}${text}${needSpaceAfter ? ' ' : ''}`;
    const newPrompt = before + insertText + after;
    setPrompt(newPrompt);
    // カーソル位置を挿入したテキストの後ろに移動
    const textarea = promptInputRef.current;
    if (textarea) {
      setTimeout(() => {
        const newCursorPos = start + insertText.length;
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
    // カーソル位置をリセット
    setCursorPosition(null);
  };

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

            {/* ステータス（編集時のみ表示） */}
            {editQueue && (
              <FormControl fullWidth size="small">
                <InputLabel>ステータス</InputLabel>
                <Select
                  value={status}
                  label="ステータス"
                  onChange={(e) => setStatus(e.target.value as PromptQueueStatus)}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            bgcolor: opt.color,
                          }}
                        />
                        {opt.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* プロンプト */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  プロンプト *
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<LibraryBooksIcon />}
                  onClick={handleOpenMasterSelector}
                >
                  マスターから挿入
                </Button>
              </Box>
              <TextField
                inputRef={promptInputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                fullWidth
                multiline
                rows={4}
                required
                error={!prompt.trim()}
                helperText={!prompt.trim() ? 'プロンプトは必須です' : ''}
                placeholder="カメラアングル、ショット距離、テンプレートなどをマスターから挿入できます"
              />
            </Box>

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

            {/* プロンプト補完セクション */}
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  プロンプト補完（Geminiで英語に最適化）
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={isEnhancing ? <CircularProgress size={16} color="inherit" /> : <EnhanceIcon />}
                  onClick={handleEnhancePrompt}
                  disabled={!prompt.trim() || isEnhancing}
                >
                  {isEnhancing ? '補完中...' : '補完する'}
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                ※ 選択した画像も参照して最適なプロンプトを生成します
              </Typography>

              {/* 補完済みプロンプトがある場合、または新規に補完した場合に表示 */}
              {(enhancedPrompt || (editQueue && editQueue.enhanced_prompt)) && (
                <>
                  <TextField
                    label="補完後のプロンプト"
                    value={enhancedPrompt || editQueue?.enhanced_prompt || ''}
                    onChange={(e) => setEnhancedPrompt(e.target.value)}
                    fullWidth
                    multiline
                    rows={4}
                    size="small"
                    sx={{ mb: 1 }}
                    placeholder="補完されたプロンプト"
                  />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant={useEnhancedPrompt ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setUseEnhancedPrompt(true)}
                      color={useEnhancedPrompt ? 'primary' : 'inherit'}
                    >
                      補完後を使用
                    </Button>
                    <Button
                      variant={!useEnhancedPrompt ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setUseEnhancedPrompt(false)}
                      color={!useEnhancedPrompt ? 'primary' : 'inherit'}
                    >
                      入力のまま使用
                    </Button>
                  </Box>
                </>
              )}
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
                  startIcon={<ImageIcon />}
                  onClick={handleOpenImageSelector}
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
        maxSelections={remainingSlots}
        currentSelections={selectedImages}
      />

      {/* マスターデータ選択ダイアログ */}
      <MasterSelectorDialog
        open={masterSelectorOpen}
        onClose={() => setMasterSelectorOpen(false)}
        onSelect={handleMasterSelect}
      />
    </>
  );
}
