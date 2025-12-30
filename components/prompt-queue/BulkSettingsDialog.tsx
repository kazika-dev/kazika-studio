'use client';

import { useState, useRef } from 'react';
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
  CircularProgress,
  FormControlLabel,
  Checkbox,
  Alert,
} from '@mui/material';
import {
  LibraryBooks as LibraryBooksIcon,
  AutoFixHigh as EnhanceIcon,
} from '@mui/icons-material';
import type { PromptQueueWithImages, PromptQueueImageType } from '@/types/prompt-queue';
import MasterSelectorDialog from './MasterSelectorDialog';
import { compressImagesForApiClient, getTotalImageSizeKB } from '@/lib/utils/clientImageCompression';

interface BulkSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  selectedQueues: PromptQueueWithImages[];
  onApply: (updates: BulkUpdateData) => Promise<void>;
}

export interface BulkUpdateData {
  prompt?: string;
  enhanced_prompt?: string;
  enhance_prompt?: 'none' | 'enhance';
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

export default function BulkSettingsDialog({
  open,
  onClose,
  selectedQueues,
  onApply,
}: BulkSettingsDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [applying, setApplying] = useState(false);
  const [masterSelectorOpen, setMasterSelectorOpen] = useState(false);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState<{ start: number; end: number } | null>(null);

  // 一括Gemini補完用の状態
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhanceProgress, setEnhanceProgress] = useState(0);
  const [enhanceResults, setEnhanceResults] = useState<{
    success: number;
    failed: number;
    results: { queueId: number; enhanced_prompt?: string; error?: string }[];
  } | null>(null);

  // 更新するフィールドを選択するチェックボックス
  const [updatePrompt, setUpdatePrompt] = useState(true);

  const handleApply = async () => {
    if (!updatePrompt || !prompt.trim()) return;

    setApplying(true);
    try {
      await onApply({
        prompt: updatePrompt ? prompt : undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to apply bulk settings:', error);
    } finally {
      setApplying(false);
    }
  };

  // 一括でGeminiプロンプト補完を実行
  const handleBulkEnhance = async () => {
    if (selectedQueues.length === 0 || isEnhancing) return;

    setIsEnhancing(true);
    setEnhanceProgress(0);
    setEnhanceResults(null);

    try {
      // 各キューの画像を収集してbase64に変換
      const queueImages: { queueId: number; prompt: string; images: { mimeType: string; data: string }[] }[] = [];

      for (const queue of selectedQueues) {
        const imageData: { mimeType: string; data: string }[] = [];

        // キューに設定されている画像を取得
        for (const img of queue.images || []) {
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
              console.error('Failed to load image:', e);
            }
          }
        }

        // 画像を圧縮（API制限対策）
        let compressedImages = imageData;
        if (imageData.length > 0) {
          console.log(`Queue ${queue.id}: Original images size: ${getTotalImageSizeKB(imageData).toFixed(1)}KB`);
          compressedImages = await compressImagesForApiClient(imageData, 3 * 1024 * 1024);
          console.log(`Queue ${queue.id}: Compressed images size: ${getTotalImageSizeKB(compressedImages).toFixed(1)}KB`);
        }

        // 共通プロンプトが設定されていればそれを使用、なければキューのプロンプトを使用
        const promptToEnhance = prompt.trim() || queue.prompt;

        queueImages.push({
          queueId: queue.id,
          prompt: promptToEnhance,
          images: compressedImages,
        });
      }

      // 一括補完APIを呼び出し
      const response = await fetch('/api/prompt-queue/bulk-enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queues: queueImages }),
      });

      if (!response.ok) {
        throw new Error('Failed to bulk enhance prompts');
      }

      const result = await response.json();
      setEnhanceResults(result);
    } catch (error) {
      console.error('Failed to bulk enhance prompts:', error);
      alert('一括プロンプト補完に失敗しました');
    } finally {
      setIsEnhancing(false);
    }
  };

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

  // マスターデータから選択したテキストをプロンプトに挿入
  const handleMasterSelect = (text: string) => {
    const start = cursorPosition?.start ?? prompt.length;
    const end = cursorPosition?.end ?? prompt.length;
    const before = prompt.substring(0, start);
    const after = prompt.substring(end);
    const needSpaceBefore = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n');
    const needSpaceAfter = after.length > 0 && !after.startsWith(' ') && !after.startsWith('\n');
    const insertText = `${needSpaceBefore ? ' ' : ''}${text}${needSpaceAfter ? ' ' : ''}`;
    const newPrompt = before + insertText + after;
    setPrompt(newPrompt);
    setCursorPosition(null);
  };

  const handleClose = () => {
    setPrompt('');
    setEnhanceResults(null);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          一括設定（{selectedQueues.length}件選択中）
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Alert severity="info">
              選択したキューに同じプロンプトを一括設定できます。
              また、各キューの画像を参照してGeminiでプロンプト補完を一括実行することもできます。
            </Alert>

            {/* 共通プロンプト設定 */}
            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={updatePrompt}
                    onChange={(e) => setUpdatePrompt(e.target.checked)}
                  />
                }
                label="共通プロンプトを設定"
              />
              {updatePrompt && (
                <Box sx={{ mt: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="body2" sx={{ flexGrow: 1 }}>
                      共通プロンプト
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
                    placeholder="全てのキューに適用するプロンプトを入力..."
                  />
                </Box>
              )}
            </Box>

            {/* 一括Gemini補完セクション */}
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                  一括プロンプト補完（Gemini AI）
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={isEnhancing ? <CircularProgress size={16} color="inherit" /> : <EnhanceIcon />}
                  onClick={handleBulkEnhance}
                  disabled={selectedQueues.length === 0 || isEnhancing}
                >
                  {isEnhancing ? '補完中...' : `一括補完（${selectedQueues.length}件）`}
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                各キューに設定されている画像を参照し、プロンプトを最適化します。
                {prompt.trim() && ' 共通プロンプトが設定されている場合はそれを基に補完します。'}
              </Typography>

              {/* 補完結果表示 */}
              {enhanceResults && (
                <Box sx={{ mt: 2 }}>
                  <Alert severity={enhanceResults.failed > 0 ? 'warning' : 'success'}>
                    補完完了: {enhanceResults.success}件成功、{enhanceResults.failed}件失敗
                  </Alert>
                  {enhanceResults.results.some(r => r.error) && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="error">
                        エラー詳細:
                      </Typography>
                      {enhanceResults.results
                        .filter(r => r.error)
                        .map((r, i) => (
                          <Typography key={i} variant="caption" display="block" color="error">
                            キュー #{r.queueId}: {r.error}
                          </Typography>
                        ))}
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>閉じる</Button>
          {updatePrompt && prompt.trim() && (
            <Button
              variant="contained"
              onClick={handleApply}
              disabled={applying}
              startIcon={applying ? <CircularProgress size={16} /> : undefined}
            >
              {applying ? '適用中...' : 'プロンプトを適用'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* マスターデータ選択ダイアログ */}
      <MasterSelectorDialog
        open={masterSelectorOpen}
        onClose={() => setMasterSelectorOpen(false)}
        onSelect={handleMasterSelect}
      />
    </>
  );
}
