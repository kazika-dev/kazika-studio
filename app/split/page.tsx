'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  IconButton,
  Chip,
  Tooltip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
} from '@mui/material';
import {
  GridOn as GridIcon,
  Refresh as RefreshIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Person as PersonIcon,
  Landscape as LandscapeIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Image as ImageIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import ImageGridSplitDialog from '@/components/prompt-queue/ImageGridSplitDialog';
import ImageSelectorDialog from '@/components/prompt-queue/ImageSelectorDialog';
import type { PromptQueueWithImages, PromptQueueImageType } from '@/types/prompt-queue';

const PAGE_SIZE = 12;
const DEFAULT_MODEL = 'gemini-3-pro-image-preview';
const DEFAULT_ASPECT_RATIO = '9:16';
const TEMPLATE_ID = 8;

const MODEL_OPTIONS = [
  { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image (推奨)' },
  { value: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image Preview (高品質)' },
];

const ASPECT_RATIO_OPTIONS = [
  { value: '1:1', label: '1:1 (正方形)' },
  { value: '16:9', label: '16:9 (横長)' },
  { value: '9:16', label: '9:16 (縦長)' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '3:2', label: '3:2' },
  { value: '2:3', label: '2:3' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: '#757575',
  processing: '#2196f3',
  completed: '#4caf50',
  failed: '#f44336',
  cancelled: '#ff9800',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '待機中',
  processing: '処理中',
  completed: '完了',
  failed: '失敗',
  cancelled: 'キャンセル',
};

interface OutputImage {
  id: number;
  content_url: string;
  output_type: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface SelectedImage {
  image_type: PromptQueueImageType;
  reference_id: number;
  name?: string;
  image_url?: string;
}

function getImageUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `/api/storage/${url}`;
}

export default function SplitPage() {
  // Output画像一覧
  const [outputs, setOutputs] = useState<OutputImage[]>([]);
  const [outputPage, setOutputPage] = useState(0);
  const [outputTotal, setOutputTotal] = useState(0);
  const [loadingOutputs, setLoadingOutputs] = useState(false);

  // キュー一覧
  const [queues, setQueues] = useState<PromptQueueWithImages[]>([]);
  const [loadingQueues, setLoadingQueues] = useState(false);

  // 一括設定
  const [bulkSettings, setBulkSettings] = useState({
    model: DEFAULT_MODEL,
    aspectRatio: DEFAULT_ASPECT_RATIO,
    prompt: '',
  });

  // 分割ダイアログ
  const [gridSplitOpen, setGridSplitOpen] = useState(false);
  const [selectedOutput, setSelectedOutput] = useState<OutputImage | null>(null);
  const [savingSplitImages, setSavingSplitImages] = useState(false);

  // キャラ/シーン選択ダイアログ
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false);
  const [editingQueueId, setEditingQueueId] = useState<number | null>(null);

  // 一括適用中
  const [applyingBulk, setApplyingBulk] = useState(false);

  // 初期ロード
  useEffect(() => {
    fetchOutputs();
    fetchQueues();
    fetchTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Output画像一覧取得
  const fetchOutputs = useCallback(async () => {
    setLoadingOutputs(true);
    try {
      const offset = outputPage * PAGE_SIZE;
      const res = await fetch(`/api/outputs?type=image&limit=${PAGE_SIZE}&offset=${offset}`);
      if (res.ok) {
        const data = await res.json();
        setOutputs(data.outputs || []);
        setOutputTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch outputs:', error);
    } finally {
      setLoadingOutputs(false);
    }
  }, [outputPage]);

  useEffect(() => {
    fetchOutputs();
  }, [outputPage, fetchOutputs]);

  // キュー一覧取得（分割で作成されたもののみ）
  const fetchQueues = async () => {
    setLoadingQueues(true);
    try {
      const res = await fetch('/api/prompt-queue?limit=100&hasSplitSource=true');
      if (res.ok) {
        const data = await res.json();
        setQueues(data.queues || []);
      }
    } catch (error) {
      console.error('Failed to fetch queues:', error);
    } finally {
      setLoadingQueues(false);
    }
  };

  // テンプレート取得
  const fetchTemplate = async () => {
    try {
      const res = await fetch('/api/master-tables/m_text_templates');
      if (res.ok) {
        const data = await res.json();
        const template = data.data?.find((t: { id: number; content?: string }) => t.id === TEMPLATE_ID);
        if (template?.content) {
          setBulkSettings((prev) => ({ ...prev, prompt: template.content }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch template:', error);
    }
  };

  // 分割ダイアログを開く
  const handleOpenGridSplit = (output: OutputImage) => {
    setSelectedOutput(output);
    setGridSplitOpen(true);
  };

  // 分割画像を保存してキューに登録
  const handleSelectSplitImages = async (images: { dataUrl: string; name: string }[]) => {
    if (images.length === 0) return;

    setSavingSplitImages(true);
    try {
      for (const img of images) {
        // 1. 分割画像をOutputとして保存
        const response = await fetch(img.dataUrl);
        const blob = await response.blob();

        const formData = new FormData();
        formData.append('file', blob, `${img.name}.png`);
        formData.append('prompt', `Split: ${img.name}`);
        if (selectedOutput?.id) {
          formData.append('originalOutputId', selectedOutput.id.toString());
        }

        const saveRes = await fetch('/api/outputs/save-edited', {
          method: 'POST',
          body: formData,
        });

        if (saveRes.ok) {
          const { output } = await saveRes.json();

          // 2. prompt-queueに登録（source_output_idで分割元を記録）
          await fetch('/api/prompt-queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: img.name,
              prompt: bulkSettings.prompt,
              model: bulkSettings.model,
              aspect_ratio: bulkSettings.aspectRatio,
              source_output_id: selectedOutput?.id,
              images: [{ image_type: 'output', reference_id: output.id }],
            }),
          });
        }
      }

      // キュー一覧を再取得
      await fetchQueues();
      // Output一覧も再取得（新しく保存された画像を表示）
      await fetchOutputs();
    } catch (error) {
      console.error('Failed to save split images:', error);
    } finally {
      setSavingSplitImages(false);
      setGridSplitOpen(false);
      setSelectedOutput(null);
    }
  };

  // キャラクター/シーン選択ダイアログを開く
  const handleOpenImageSelector = (queueId: number) => {
    setEditingQueueId(queueId);
    setImageSelectorOpen(true);
  };

  // キャラクター/シーン選択確定
  const handleSelectImages = async (selectedImages: SelectedImage[]) => {
    if (!editingQueueId || selectedImages.length === 0) {
      setImageSelectorOpen(false);
      return;
    }

    const queue = queues.find((q) => q.id === editingQueueId);
    if (!queue) {
      setImageSelectorOpen(false);
      return;
    }

    // 既存の画像に新しい画像を追加
    const existingImages = queue.images.map((img) => ({
      image_type: img.image_type,
      reference_id: img.reference_id,
    }));

    const newImages = [
      ...existingImages,
      ...selectedImages.map((img) => ({
        image_type: img.image_type,
        reference_id: img.reference_id,
      })),
    ];

    try {
      await fetch(`/api/prompt-queue/${editingQueueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: newImages }),
      });
      await fetchQueues();
    } catch (error) {
      console.error('Failed to update queue images:', error);
    }

    setImageSelectorOpen(false);
    setEditingQueueId(null);
  };

  // キューから画像を削除
  const handleRemoveImage = async (queueId: number, imageType: PromptQueueImageType, referenceId: number) => {
    const queue = queues.find((q) => q.id === queueId);
    if (!queue) return;

    const newImages = queue.images
      .filter((img) => !(img.image_type === imageType && img.reference_id === referenceId))
      .map((img) => ({
        image_type: img.image_type,
        reference_id: img.reference_id,
      }));

    try {
      await fetch(`/api/prompt-queue/${queueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: newImages }),
      });
      await fetchQueues();
    } catch (error) {
      console.error('Failed to remove image from queue:', error);
    }
  };

  // キュー削除
  const handleDeleteQueue = async (queueId: number) => {
    if (!confirm('このキューを削除しますか？')) return;

    try {
      await fetch(`/api/prompt-queue/${queueId}`, { method: 'DELETE' });
      await fetchQueues();
    } catch (error) {
      console.error('Failed to delete queue:', error);
    }
  };

  // キュー実行
  const handleExecuteQueue = async (queueId: number) => {
    try {
      await fetch(`/api/prompt-queue/${queueId}/execute`, { method: 'POST' });
      await fetchQueues();
    } catch (error) {
      console.error('Failed to execute queue:', error);
    }
  };

  // 一括設定適用
  const handleApplyBulkSettings = async () => {
    const pendingQueues = queues.filter((q) => q.status === 'pending');
    if (pendingQueues.length === 0) {
      alert('待機中のキューがありません');
      return;
    }

    if (!confirm(`待機中の${pendingQueues.length}件のキューに設定を適用しますか？`)) return;

    setApplyingBulk(true);
    try {
      const queueIds = pendingQueues.map((q) => q.id);
      await fetch('/api/prompt-queue/bulk-update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queue_ids: queueIds,
          updates: {
            prompt: bulkSettings.prompt,
            model: bulkSettings.model,
            aspect_ratio: bulkSettings.aspectRatio,
          },
        }),
      });
      await fetchQueues();
    } catch (error) {
      console.error('Failed to apply bulk settings:', error);
    } finally {
      setApplyingBulk(false);
    }
  };

  const totalOutputPages = Math.ceil(outputTotal / PAGE_SIZE);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <GridIcon />
        画像分割・キュー登録
      </Typography>

      {/* 一括設定パネル */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon />
          一括設定
        </Typography>
        <Grid container spacing={2} alignItems="flex-start">
          <Grid size={{ xs: 12, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>モデル</InputLabel>
              <Select
                value={bulkSettings.model}
                label="モデル"
                onChange={(e) => setBulkSettings((prev) => ({ ...prev, model: e.target.value }))}
              >
                {MODEL_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>アスペクト比</InputLabel>
              <Select
                value={bulkSettings.aspectRatio}
                label="アスペクト比"
                onChange={(e) => setBulkSettings((prev) => ({ ...prev, aspectRatio: e.target.value }))}
              >
                {ASPECT_RATIO_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <TextField
              fullWidth
              size="small"
              label="プロンプト"
              multiline
              rows={2}
              value={bulkSettings.prompt}
              onChange={(e) => setBulkSettings((prev) => ({ ...prev, prompt: e.target.value }))}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <Button
              variant="contained"
              fullWidth
              onClick={handleApplyBulkSettings}
              disabled={applyingBulk}
              startIcon={applyingBulk ? <CircularProgress size={16} /> : undefined}
            >
              {applyingBulk ? '適用中...' : '全キューに適用'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Output画像選択セクション */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ImageIcon />
            Output画像（クリックで分割）
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={fetchOutputs} size="small">
              <RefreshIcon />
            </IconButton>
            {totalOutputPages > 1 && (
              <>
                <IconButton
                  onClick={() => setOutputPage((p) => Math.max(0, p - 1))}
                  disabled={outputPage === 0}
                  size="small"
                >
                  <ChevronLeftIcon />
                </IconButton>
                <Typography variant="body2">
                  {outputPage + 1} / {totalOutputPages}
                </Typography>
                <IconButton
                  onClick={() => setOutputPage((p) => Math.min(totalOutputPages - 1, p + 1))}
                  disabled={outputPage >= totalOutputPages - 1}
                  size="small"
                >
                  <ChevronRightIcon />
                </IconButton>
              </>
            )}
          </Box>
        </Box>

        {loadingOutputs ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={1}>
            {outputs.map((output) => (
              <Grid size={{ xs: 4, sm: 3, md: 2, lg: 1.5 }} key={output.id}>
                <Box
                  onClick={() => handleOpenGridSplit(output)}
                  sx={{
                    position: 'relative',
                    aspectRatio: '1',
                    borderRadius: 1,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: '1px solid #ddd',
                    '&:hover': {
                      borderColor: '#1976d2',
                      '& .split-overlay': { opacity: 1 },
                    },
                  }}
                >
                  <img
                    src={getImageUrl(output.content_url)}
                    alt={output.metadata?.name || `Output #${output.id}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <Box
                    className="split-overlay"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      bgcolor: 'rgba(0,0,0,0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    <GridIcon sx={{ color: 'white', fontSize: 32 }} />
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      {/* キュー一覧 */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            登録済みキュー（{queues.length}件）
          </Typography>
          <IconButton onClick={fetchQueues} size="small">
            <RefreshIcon />
          </IconButton>
        </Box>

        {loadingQueues ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : queues.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={4}>
            キューがありません。上の画像をクリックして分割・登録してください。
          </Typography>
        ) : (
          <List>
            {queues.map((queue) => (
              <ListItem
                key={queue.id}
                sx={{
                  border: '1px solid #e0e0e0',
                  borderRadius: 1,
                  mb: 1,
                  bgcolor: 'background.paper',
                }}
              >
                {/* 分割元画像 */}
                {queue.source_output_url && (
                  <Tooltip title="分割元画像">
                    <Avatar
                      src={getImageUrl(queue.source_output_url)}
                      variant="rounded"
                      sx={{
                        width: 40,
                        height: 40,
                        mr: 1,
                        border: '2px solid #e91e63',
                        opacity: 0.8,
                      }}
                    />
                  </Tooltip>
                )}
                <ListItemAvatar>
                  {queue.images.length > 0 && queue.images[0].image_url ? (
                    <Avatar
                      src={getImageUrl(queue.images[0].image_url)}
                      variant="rounded"
                      sx={{ width: 56, height: 56 }}
                    />
                  ) : (
                    <Avatar variant="rounded" sx={{ width: 56, height: 56, bgcolor: 'grey.300' }}>
                      <ImageIcon />
                    </Avatar>
                  )}
                </ListItemAvatar>

                <ListItemText
                  sx={{ ml: 2 }}
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1">{queue.name || `キュー #${queue.id}`}</Typography>
                      <Chip
                        label={STATUS_LABELS[queue.status] || queue.status}
                        size="small"
                        sx={{
                          bgcolor: STATUS_COLORS[queue.status],
                          color: 'white',
                        }}
                      />
                      <Chip label={queue.aspect_ratio} size="small" variant="outlined" />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 400,
                        }}
                      >
                        {queue.prompt}
                      </Typography>
                      {/* 参照画像サムネイル */}
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                        {queue.images.map((img, idx) => (
                          <Tooltip key={idx} title={`${img.image_type}: ${img.name || img.reference_id}`}>
                            <Box
                              sx={{
                                position: 'relative',
                                width: 32,
                                height: 32,
                                borderRadius: 0.5,
                                overflow: 'hidden',
                                border: `2px solid ${
                                  img.image_type === 'character_sheet'
                                    ? '#1976d2'
                                    : img.image_type === 'scene'
                                    ? '#0288d1'
                                    : img.image_type === 'output'
                                    ? '#9c27b0'
                                    : '#ff9800'
                                }`,
                              }}
                            >
                              {img.image_url ? (
                                <img
                                  src={getImageUrl(img.image_url)}
                                  alt={img.name || ''}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                <Box
                                  sx={{
                                    width: '100%',
                                    height: '100%',
                                    bgcolor: 'grey.200',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  {img.image_type === 'character_sheet' ? (
                                    <PersonIcon sx={{ fontSize: 16 }} />
                                  ) : img.image_type === 'scene' ? (
                                    <LandscapeIcon sx={{ fontSize: 16 }} />
                                  ) : (
                                    <ImageIcon sx={{ fontSize: 16 }} />
                                  )}
                                </Box>
                              )}
                              <IconButton
                                size="small"
                                onClick={() => handleRemoveImage(queue.id, img.image_type, img.reference_id)}
                                sx={{
                                  position: 'absolute',
                                  top: -8,
                                  right: -8,
                                  width: 16,
                                  height: 16,
                                  bgcolor: 'error.main',
                                  color: 'white',
                                  '&:hover': { bgcolor: 'error.dark' },
                                }}
                              >
                                <CloseIcon sx={{ fontSize: 10 }} />
                              </IconButton>
                            </Box>
                          </Tooltip>
                        ))}
                      </Box>
                    </Box>
                  }
                />

                <ListItemSecondaryAction>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="参照画像追加（キャラクター/シーン）">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenImageSelector(queue.id)}
                        color="primary"
                      >
                        <PersonIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="削除">
                      <IconButton size="small" onClick={() => handleDeleteQueue(queue.id)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="実行">
                      <IconButton
                        size="small"
                        onClick={() => handleExecuteQueue(queue.id)}
                        color="success"
                        disabled={queue.status !== 'pending' && queue.status !== 'failed'}
                      >
                        <PlayIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {/* 分割ダイアログ */}
      {selectedOutput && (
        <ImageGridSplitDialog
          open={gridSplitOpen}
          onClose={() => {
            setGridSplitOpen(false);
            setSelectedOutput(null);
          }}
          imageUrl={getImageUrl(selectedOutput.content_url)}
          imageName={selectedOutput.metadata?.name || `Output_${selectedOutput.id}`}
          onSelectSplitImages={handleSelectSplitImages}
          maxSelections={99}
        />
      )}

      {/* キャラクター/シーン選択ダイアログ */}
      <ImageSelectorDialog
        open={imageSelectorOpen}
        onClose={() => {
          setImageSelectorOpen(false);
          setEditingQueueId(null);
        }}
        onSelect={handleSelectImages}
        maxSelections={8}
        currentSelections={
          editingQueueId
            ? queues
                .find((q) => q.id === editingQueueId)
                ?.images.map((img) => ({
                  image_type: img.image_type,
                  reference_id: img.reference_id,
                  name: img.name || undefined,
                  image_url: img.image_url || undefined,
                })) || []
            : []
        }
      />

      {/* 保存中オーバーレイ */}
      {savingSplitImages && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <Paper sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress />
            <Typography>分割画像を保存中...</Typography>
          </Paper>
        </Box>
      )}
    </Box>
  );
}
