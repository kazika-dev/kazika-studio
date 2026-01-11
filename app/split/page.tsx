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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
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
  AutoAwesome as AutoAwesomeIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import ImageGridSplitDialog from '@/components/prompt-queue/ImageGridSplitDialog';
import ImageSelectorDialog from '@/components/prompt-queue/ImageSelectorDialog';
import type { PromptQueueWithImages, PromptQueueImageType } from '@/types/prompt-queue';

const PAGE_SIZE = 12;
const DEFAULT_MODEL = 'gemini-3-pro-image-preview';
const DEFAULT_ASPECT_RATIO = '9:16';

// クライアント側で画像を圧縮するヘルパー関数
async function compressImageClient(
  base64Data: string,
  mimeType: string,
  maxSizeKB: number = 500
): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      // 最大1024pxにリサイズ
      const maxDim = 1024;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);

      // JPEG品質を調整して目標サイズに近づける
      let quality = 0.8;
      let result = canvas.toDataURL('image/jpeg', quality);

      while (result.length > maxSizeKB * 1024 * 1.37 && quality > 0.1) {
        quality -= 0.1;
        result = canvas.toDataURL('image/jpeg', quality);
      }

      const compressedBase64 = result.split(',')[1];
      resolve({ data: compressedBase64, mimeType: 'image/jpeg' });
    };
    img.src = `data:${mimeType};base64,${base64Data}`;
  });
}
const TEMPLATE_ID = 8;

const MODEL_OPTIONS = [
  { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image (推奨)' },
  { value: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image Preview (高品質)' },
];

// プロンプト生成用のGeminiモデル
const PROMPT_GEN_MODEL_OPTIONS = [
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview (推奨)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (高速)' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (高性能)' },
];

const LANGUAGE_OPTIONS = [
  { value: 'ja', label: '日本語' },
  { value: 'en', label: '英語' },
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

  // 一括キャラクターシート設定
  const [bulkCharacterSelectorOpen, setBulkCharacterSelectorOpen] = useState(false);
  const [bulkCharacterSheetIds, setBulkCharacterSheetIds] = useState<SelectedImage[]>([]);
  const [applyingBulkCharacters, setApplyingBulkCharacters] = useState(false);

  // プロンプト生成設定
  const [promptGenSettings, setPromptGenSettings] = useState({
    model: 'gemini-3-pro-preview',
    language: 'en' as 'ja' | 'en',
    basePrompt: '',
  });
  const [generatingPrompts, setGeneratingPrompts] = useState(false);

  // プロンプト生成対象の選択
  const [selectedQueueIds, setSelectedQueueIds] = useState<Set<number>>(new Set());

  // enhanced_prompt編集ダイアログ
  const [enhancedPromptDialogOpen, setEnhancedPromptDialogOpen] = useState(false);
  const [editingEnhancedPromptQueue, setEditingEnhancedPromptQueue] = useState<PromptQueueWithImages | null>(null);
  const [editingEnhancedPromptValue, setEditingEnhancedPromptValue] = useState('');
  const [savingEnhancedPrompt, setSavingEnhancedPrompt] = useState(false);

  // 表示するキュー（APIで既にフィルタ済み: hasSplitSource=true & status=pending）
  const displayQueues = queues;

  // 選択可能なキュー（表示キューの中で画像あり）
  const selectableQueues = displayQueues.filter((q) => q.images && q.images.length > 0);

  // キュー選択のトグル
  const handleToggleQueueSelection = (queueId: number) => {
    setSelectedQueueIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(queueId)) {
        newSet.delete(queueId);
      } else {
        newSet.add(queueId);
      }
      return newSet;
    });
  };

  // 全選択/全解除
  const handleSelectAllQueues = () => {
    if (selectedQueueIds.size === displayQueues.length) {
      // 全解除
      setSelectedQueueIds(new Set());
    } else {
      // 全選択
      setSelectedQueueIds(new Set(displayQueues.map((q) => q.id)));
    }
  };

  // 画像拡大表示用
  const [enlargedImageUrl, setEnlargedImageUrl] = useState<string | null>(null);

  // 初期ロード
  useEffect(() => {
    fetchOutputs();
    fetchQueues();
    fetchTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Output画像一覧取得（分割画像は除外）
  const fetchOutputs = useCallback(async () => {
    setLoadingOutputs(true);
    try {
      const offset = outputPage * PAGE_SIZE;
      const res = await fetch(`/api/outputs?type=image&limit=${PAGE_SIZE}&offset=${offset}&exclude_split=true`);
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

  // キュー一覧取得（分割で作成されたもの かつ pending のみ）
  const fetchQueues = async () => {
    setLoadingQueues(true);
    try {
      const res = await fetch('/api/prompt-queue?limit=100&hasSplitSource=true&status=pending');
      if (res.ok) {
        const data = await res.json();
        console.log('Fetched queues (hasSplitSource=true, status=pending):', data.queues?.length);
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
          // プロンプト生成設定にも同じテンプレートを設定
          setPromptGenSettings((prev) => ({ ...prev, basePrompt: template.content }));
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

    console.log('handleSelectSplitImages called, selectedOutput:', selectedOutput);

    setSavingSplitImages(true);
    try {
      for (const img of images) {
        // 1. 分割画像をOutputとして保存
        const response = await fetch(img.dataUrl);
        const blob = await response.blob();

        const formData = new FormData();
        formData.append('file', blob, `${img.name}.png`);
        formData.append('prompt', `Split: ${img.name}`);
        formData.append('is_split_image', 'true');
        if (selectedOutput?.id) {
          formData.append('originalOutputId', selectedOutput.id.toString());
        }

        const saveRes = await fetch('/api/outputs/save-edited', {
          method: 'POST',
          body: formData,
        });

        if (saveRes.ok) {
          const { output } = await saveRes.json();

          const queueData = {
            name: img.name,
            prompt: bulkSettings.prompt,
            model: bulkSettings.model,
            aspect_ratio: bulkSettings.aspectRatio,
            source_output_id: selectedOutput?.id,
            images: [{ image_type: 'output', reference_id: output.id }],
          };
          console.log('Creating queue with data:', queueData);

          // 2. prompt-queueに登録（source_output_idで分割元を記録）
          const queueRes = await fetch('/api/prompt-queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(queueData),
          });
          const queueResult = await queueRes.json();
          console.log('Queue created:', queueResult);
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

    // 既存の画像に新しい画像を追加（reference_id を確実に数値に変換）
    const existingImages = queue.images.map((img) => ({
      image_type: img.image_type,
      reference_id: typeof img.reference_id === 'number' ? img.reference_id : parseInt(String(img.reference_id), 10),
    }));

    const newImages = [
      ...existingImages,
      ...selectedImages.map((img) => ({
        image_type: img.image_type,
        reference_id: typeof img.reference_id === 'number' ? img.reference_id : parseInt(String(img.reference_id), 10),
      })),
    ];

    try {
      console.log('Updating queue images:', { queueId: editingQueueId, images: newImages });
      const res = await fetch(`/api/prompt-queue/${editingQueueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: newImages }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        console.error('Failed to update queue images:', res.status, errorData);
      }
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
        reference_id: typeof img.reference_id === 'number' ? img.reference_id : parseInt(String(img.reference_id), 10),
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

  // 一括削除
  const [deletingBulk, setDeletingBulk] = useState(false);
  const handleBulkDelete = async () => {
    if (selectedQueueIds.size === 0) {
      alert('削除するキューを選択してください');
      return;
    }

    if (!confirm(`${selectedQueueIds.size}件のキューを削除しますか？この操作は取り消せません。`)) return;

    setDeletingBulk(true);
    try {
      const deletePromises = Array.from(selectedQueueIds).map((queueId) =>
        fetch(`/api/prompt-queue/${queueId}`, { method: 'DELETE' })
      );
      await Promise.all(deletePromises);
      setSelectedQueueIds(new Set());
      await fetchQueues();
      alert(`${selectedQueueIds.size}件のキューを削除しました`);
    } catch (error) {
      console.error('Failed to bulk delete queues:', error);
      alert('一括削除に失敗しました');
    } finally {
      setDeletingBulk(false);
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

  // 一括キャラクターシート選択確定
  const handleBulkCharacterSelect = (images: SelectedImage[]) => {
    setBulkCharacterSheetIds(images);
    setBulkCharacterSelectorOpen(false);
  };

  // 一括キャラクターシート適用
  const handleApplyBulkCharacters = async () => {
    if (bulkCharacterSheetIds.length === 0) {
      alert('キャラクターシートを選択してください');
      return;
    }

    // 選択されたキューが対象（選択がなければ全キューが対象）
    let targetQueues: PromptQueueWithImages[];
    if (selectedQueueIds.size > 0) {
      targetQueues = queues.filter((q) => selectedQueueIds.has(q.id));
    } else {
      targetQueues = displayQueues;
    }

    if (targetQueues.length === 0) {
      alert('適用対象のキューがありません');
      return;
    }

    if (!confirm(`${targetQueues.length}件のキューに${bulkCharacterSheetIds.length}枚のキャラクターシートを追加しますか？`)) return;

    setApplyingBulkCharacters(true);
    try {
      for (const queue of targetQueues) {
        // 既存の画像に新しいキャラクターシートを追加（重複を除外）
        const existingImages = queue.images.map((img) => ({
          image_type: img.image_type,
          reference_id: typeof img.reference_id === 'number' ? img.reference_id : parseInt(String(img.reference_id), 10),
        }));

        const newImages = [...existingImages];
        for (const cs of bulkCharacterSheetIds) {
          const refId = typeof cs.reference_id === 'number' ? cs.reference_id : parseInt(String(cs.reference_id), 10);
          const exists = existingImages.some(
            (img) => img.image_type === cs.image_type && img.reference_id === refId
          );
          if (!exists) {
            newImages.push({
              image_type: cs.image_type,
              reference_id: refId,
            });
          }
        }

        // 最大8枚に制限
        const limitedImages = newImages.slice(0, 8);

        await fetch(`/api/prompt-queue/${queue.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: limitedImages }),
        });
      }

      await fetchQueues();
      alert(`${targetQueues.length}件のキューにキャラクターシートを追加しました`);
    } catch (error) {
      console.error('Failed to apply bulk characters:', error);
      alert('キャラクターシートの一括適用に失敗しました');
    } finally {
      setApplyingBulkCharacters(false);
    }
  };

  // enhanced_prompt編集ダイアログを開く
  const handleOpenEnhancedPromptDialog = (queue: PromptQueueWithImages) => {
    setEditingEnhancedPromptQueue(queue);
    setEditingEnhancedPromptValue(queue.enhanced_prompt || '');
    setEnhancedPromptDialogOpen(true);
  };

  // enhanced_promptを保存
  const handleSaveEnhancedPrompt = async () => {
    if (!editingEnhancedPromptQueue) return;

    setSavingEnhancedPrompt(true);
    try {
      const res = await fetch(`/api/prompt-queue/${editingEnhancedPromptQueue.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enhanced_prompt: editingEnhancedPromptValue || null,
          enhance_prompt: editingEnhancedPromptValue ? 'enhance' : 'none',
        }),
      });

      if (res.ok) {
        // ローカル状態を更新
        setQueues((prev) =>
          prev.map((q) =>
            q.id === editingEnhancedPromptQueue.id
              ? { ...q, enhanced_prompt: editingEnhancedPromptValue || null }
              : q
          )
        );
        setEnhancedPromptDialogOpen(false);
      } else {
        const error = await res.json();
        alert(`保存に失敗しました: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to save enhanced prompt:', error);
      alert('保存に失敗しました');
    } finally {
      setSavingEnhancedPrompt(false);
    }
  };

  // 一括プロンプト生成
  // プロンプト生成進捗状態
  const [promptGenProgress, setPromptGenProgress] = useState({ current: 0, total: 0 });

  const handleBulkGeneratePrompts = async () => {
    // 選択されたキューが対象（選択がなければ全ての選択可能なキューが対象）
    let targetQueues: PromptQueueWithImages[];
    if (selectedQueueIds.size > 0) {
      targetQueues = queues.filter((q) => selectedQueueIds.has(q.id));
    } else {
      // 選択がない場合は選択可能なキュー全て
      targetQueues = selectableQueues;
    }

    if (targetQueues.length === 0) {
      alert('プロンプト生成対象のキューがありません。\n待機中かつ画像を持つキューを選択してください。');
      return;
    }

    const languageLabel = promptGenSettings.language === 'ja' ? '日本語' : '英語';
    if (!confirm(`${targetQueues.length}件のキューに対して${languageLabel}でプロンプトを生成しますか？\n\n※各キューの参照画像からプロンプトを自動生成します。`)) return;

    setGeneratingPrompts(true);
    setPromptGenProgress({ current: 0, total: targetQueues.length });

    let successCount = 0;
    let failedCount = 0;

    try {
      // キューごとに順次処理（Vercelタイムアウト対策）
      for (let i = 0; i < targetQueues.length; i++) {
        const queue = targetQueues[i];
        setPromptGenProgress({ current: i + 1, total: targetQueues.length });

        try {
          // 画像を取得してbase64に変換
          const images: { mimeType: string; data: string }[] = [];

          for (const img of queue.images.slice(0, 4)) {
            if (img.image_url) {
              try {
                const imageUrl = getImageUrl(img.image_url);
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                const base64 = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const result = reader.result as string;
                    // data:image/png;base64,... の形式から base64 部分を抽出
                    const base64Data = result.split(',')[1];
                    resolve(base64Data);
                  };
                  reader.readAsDataURL(blob);
                });
                // 画像を圧縮（各画像500KB以下に）
                const compressed = await compressImageClient(base64, blob.type || 'image/png', 500);
                images.push({
                  mimeType: compressed.mimeType,
                  data: compressed.data,
                });
              } catch (error) {
                console.error(`Failed to fetch image for queue ${queue.id}:`, error);
              }
            }
          }

          if (images.length === 0) {
            console.warn(`No images for queue ${queue.id}, skipping`);
            failedCount++;
            continue;
          }

          // 1キューずつAPIを呼び出し
          const res = await fetch('/api/prompt-queue/generate-prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              queueId: queue.id,
              images,
              model: promptGenSettings.model,
              language: promptGenSettings.language,
              basePrompt: promptGenSettings.basePrompt,
            }),
          });

          if (res.ok) {
            successCount++;
          } else {
            const error = await res.json();
            console.error(`Failed to generate prompt for queue ${queue.id}:`, error);
            failedCount++;
          }
        } catch (error) {
          console.error(`Error processing queue ${queue.id}:`, error);
          failedCount++;
        }
      }

      alert(`プロンプト生成完了\n成功: ${successCount}件\n失敗: ${failedCount}件`);
      await fetchQueues();
    } catch (error) {
      console.error('Failed to bulk generate prompts:', error);
      alert('プロンプト生成に失敗しました');
    } finally {
      setGeneratingPrompts(false);
      setPromptGenProgress({ current: 0, total: 0 });
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

      {/* 一括キャラクターシート設定パネル */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'info.50' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon />
            一括キャラクターシート設定
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              対象: {selectedQueueIds.size > 0 ? `${selectedQueueIds.size}件選択中` : `全${displayQueues.length}件`}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={handleSelectAllQueues}
              disabled={displayQueues.length === 0}
            >
              {selectedQueueIds.size === displayQueues.length && displayQueues.length > 0 ? '全解除' : '全選択'}
            </Button>
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          選択したキャラクターシートをキューに追加します（既存の画像に追加、最大8枚。下のキュー一覧でチェックして対象を選択）
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                startIcon={<PersonIcon />}
                onClick={() => setBulkCharacterSelectorOpen(true)}
              >
                キャラクターを選択
              </Button>
              {bulkCharacterSheetIds.length > 0 && (
                <>
                  <Typography variant="body2" color="text.secondary">
                    {bulkCharacterSheetIds.length}枚選択中:
                  </Typography>
                  {bulkCharacterSheetIds.map((cs, idx) => (
                    <Chip
                      key={idx}
                      label={cs.name || `#${cs.reference_id}`}
                      size="small"
                      onDelete={() => {
                        setBulkCharacterSheetIds((prev) =>
                          prev.filter((_, i) => i !== idx)
                        );
                      }}
                      avatar={
                        cs.image_url ? (
                          <Avatar src={getImageUrl(cs.image_url)} />
                        ) : undefined
                      }
                    />
                  ))}
                </>
              )}
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Button
              variant="contained"
              color="info"
              fullWidth
              onClick={handleApplyBulkCharacters}
              disabled={applyingBulkCharacters || bulkCharacterSheetIds.length === 0 || displayQueues.length === 0}
              startIcon={applyingBulkCharacters ? <CircularProgress size={16} /> : <PersonIcon />}
            >
              {applyingBulkCharacters ? '適用中...' : `適用 (${selectedQueueIds.size > 0 ? selectedQueueIds.size : displayQueues.length}件)`}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* 一括プロンプト生成パネル */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'primary.50' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeIcon />
            一括プロンプト生成（画像から）
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              対象: {selectedQueueIds.size > 0 ? `${selectedQueueIds.size}件選択中` : `全${selectableQueues.length}件`}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={handleSelectAllQueues}
              disabled={selectableQueues.length === 0}
            >
              {selectedQueueIds.size === selectableQueues.length && selectableQueues.length > 0 ? '全解除' : '全選択'}
            </Button>
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          キューの参照画像を分析して、AIが自動的にプロンプトを生成します（下のキュー一覧でチェックして対象を選択、enhanced_promptに保存）
        </Typography>
        <Grid container spacing={2} alignItems="flex-start">
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>AIモデル</InputLabel>
              <Select
                value={promptGenSettings.model}
                label="AIモデル"
                onChange={(e) => setPromptGenSettings((prev) => ({ ...prev, model: e.target.value }))}
              >
                {PROMPT_GEN_MODEL_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>出力言語</InputLabel>
              <Select
                value={promptGenSettings.language}
                label="出力言語"
                onChange={(e) => setPromptGenSettings((prev) => ({ ...prev, language: e.target.value as 'ja' | 'en' }))}
              >
                {LANGUAGE_OPTIONS.map((opt) => (
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
              label="ベースプロンプト（AIへの指示）"
              multiline
              rows={2}
              value={promptGenSettings.basePrompt}
              onChange={(e) => setPromptGenSettings((prev) => ({ ...prev, basePrompt: e.target.value }))}
              placeholder="画像からプロンプトを生成する際のAIへの追加指示"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Button
              variant="contained"
              color="secondary"
              fullWidth
              onClick={handleBulkGeneratePrompts}
              disabled={generatingPrompts || selectableQueues.length === 0}
              startIcon={generatingPrompts ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
              sx={{ height: 56 }}
            >
              {generatingPrompts
                ? `生成中... (${promptGenProgress.current}/${promptGenProgress.total})`
                : `プロンプト生成 (${selectedQueueIds.size > 0 ? selectedQueueIds.size : selectableQueues.length}件)`}
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
                    alt={(output.metadata?.name as string) || `Output #${output.id}`}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6">
              登録済みキュー（{displayQueues.length}件）
            </Typography>
            {selectedQueueIds.size > 0 && (
              <Chip
                label={`${selectedQueueIds.size}件選択中`}
                size="small"
                color="primary"
                onDelete={() => setSelectedQueueIds(new Set())}
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {selectedQueueIds.size > 0 && (
              <Button
                variant="contained"
                color="error"
                size="small"
                onClick={handleBulkDelete}
                disabled={deletingBulk}
                startIcon={deletingBulk ? <CircularProgress size={14} /> : <DeleteIcon />}
              >
                {deletingBulk ? '削除中...' : `一括削除 (${selectedQueueIds.size}件)`}
              </Button>
            )}
            <IconButton onClick={fetchQueues} size="small">
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>

        {loadingQueues ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : displayQueues.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={4}>
            キューがありません。上の画像をクリックして分割・登録してください。
          </Typography>
        ) : (
          <List>
            {displayQueues.map((queue) => {
              // 画像ありなら選択可能
              const isSelectable = queue.images && queue.images.length > 0;
              const isSelected = selectedQueueIds.has(queue.id);

              return (
              <ListItem
                key={queue.id}
                sx={{
                  border: isSelected ? '2px solid #9c27b0' : '1px solid #e0e0e0',
                  borderRadius: 1,
                  mb: 1,
                  bgcolor: isSelected ? 'rgba(156, 39, 176, 0.05)' : 'background.paper',
                }}
              >
                {/* プロンプト生成対象選択チェックボックス */}
                {isSelectable && (
                  <Checkbox
                    checked={isSelected}
                    onChange={() => handleToggleQueueSelection(queue.id)}
                    sx={{ mr: 1 }}
                    color="secondary"
                  />
                )}
                {/* 分割元画像（大きめに表示） */}
                {queue.source_output_url && (
                  <Tooltip title="分割元画像（クリックで拡大）">
                    <Box
                      onClick={() => setEnlargedImageUrl(getImageUrl(queue.source_output_url!))}
                      sx={{
                        width: 120,
                        height: 120,
                        mr: 2,
                        borderRadius: 1,
                        border: '3px solid #e91e63',
                        overflow: 'hidden',
                        flexShrink: 0,
                        opacity: 0.9,
                        cursor: 'pointer',
                        '&:hover': { opacity: 1, borderColor: '#c2185b' },
                      }}
                    >
                      <img
                        src={getImageUrl(queue.source_output_url)}
                        alt="分割元"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </Box>
                  </Tooltip>
                )}
                {/* メインサムネイル（大きめに表示） */}
                <Box sx={{ flexShrink: 0, mr: 2 }}>
                  {queue.images.length > 0 && queue.images[0].image_url ? (
                    <Tooltip title="クリックで拡大">
                      <Box
                        onClick={() => setEnlargedImageUrl(getImageUrl(queue.images[0].image_url!))}
                        sx={{
                          width: 120,
                          height: 120,
                          borderRadius: 1,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          border: '2px solid #1976d2',
                          '&:hover': { opacity: 0.8, borderColor: '#1565c0' },
                        }}
                      >
                        <img
                          src={getImageUrl(queue.images[0].image_url)}
                          alt="メイン"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </Box>
                    </Tooltip>
                  ) : (
                    <Box
                      sx={{
                        width: 120,
                        height: 120,
                        borderRadius: 1,
                        bgcolor: 'grey.300',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ImageIcon sx={{ fontSize: 48, color: 'grey.500' }} />
                    </Box>
                  )}
                </Box>

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
                      {/* enhanced_prompt表示・編集 */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          mt: 0.5,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                          borderRadius: 0.5,
                          p: 0.5,
                          ml: -0.5,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEnhancedPromptDialog(queue);
                        }}
                      >
                        <Tooltip title="クリックで編集">
                          <EditIcon sx={{ fontSize: 14, color: 'secondary.main' }} />
                        </Tooltip>
                        {queue.enhanced_prompt ? (
                          <Typography
                            variant="body2"
                            sx={{
                              color: 'secondary.main',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 380,
                              fontStyle: 'italic',
                            }}
                          >
                            ✨ {queue.enhanced_prompt}
                          </Typography>
                        ) : (
                          <Typography
                            variant="body2"
                            sx={{ color: 'text.disabled', fontStyle: 'italic' }}
                          >
                            (enhanced_promptなし - クリックで追加)
                          </Typography>
                        )}
                      </Box>
                      {/* 参照画像サムネイル */}
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                        {queue.images.map((img, idx) => (
                          <Tooltip key={idx} title={`${img.image_type}: ${img.name || img.reference_id}（クリックで拡大）`}>
                            <Box
                              onClick={() => img.image_url && setEnlargedImageUrl(getImageUrl(img.image_url))}
                              sx={{
                                position: 'relative',
                                width: 32,
                                height: 32,
                                borderRadius: 0.5,
                                overflow: 'hidden',
                                cursor: img.image_url ? 'pointer' : 'default',
                                border: `2px solid ${
                                  img.image_type === 'character_sheet'
                                    ? '#1976d2'
                                    : img.image_type === 'scene'
                                    ? '#0288d1'
                                    : img.image_type === 'output'
                                    ? '#9c27b0'
                                    : '#ff9800'
                                }`,
                                '&:hover': img.image_url ? { opacity: 0.8 } : {},
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveImage(queue.id, img.image_type, img.reference_id);
                                }}
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
              );
            })}
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
          imageName={(selectedOutput.metadata?.name as string) || `Output_${selectedOutput.id}`}
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

      {/* 一括キャラクターシート選択ダイアログ */}
      <ImageSelectorDialog
        open={bulkCharacterSelectorOpen}
        onClose={() => setBulkCharacterSelectorOpen(false)}
        onSelect={handleBulkCharacterSelect}
        maxSelections={4}
        currentSelections={bulkCharacterSheetIds}
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

      {/* 画像拡大ダイアログ */}
      <Dialog
        open={!!enlargedImageUrl}
        onClose={() => setEnlargedImageUrl(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogContent
          sx={{
            p: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            bgcolor: 'black',
            position: 'relative',
          }}
        >
          <IconButton
            onClick={() => setEnlargedImageUrl(null)}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'rgba(255,255,255,0.8)',
              '&:hover': { bgcolor: 'rgba(255,255,255,1)' },
            }}
          >
            <CloseIcon />
          </IconButton>
          {enlargedImageUrl && (
            <img
              src={enlargedImageUrl}
              alt="拡大画像"
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                objectFit: 'contain',
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* enhanced_prompt編集ダイアログ */}
      <Dialog
        open={enhancedPromptDialogOpen}
        onClose={() => setEnhancedPromptDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeIcon color="secondary" />
          Enhanced Prompt 編集
          {editingEnhancedPromptQueue && (
            <Chip
              label={`キュー #${editingEnhancedPromptQueue.id}`}
              size="small"
              variant="outlined"
              sx={{ ml: 1 }}
            />
          )}
        </DialogTitle>
        <DialogContent>
          {editingEnhancedPromptQueue && (
            <Box>
              {/* 元のプロンプト表示 */}
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                元のプロンプト:
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  p: 1,
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  mb: 2,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {editingEnhancedPromptQueue.prompt || '(なし)'}
              </Typography>

              {/* 参照画像表示 */}
              {editingEnhancedPromptQueue.images && editingEnhancedPromptQueue.images.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                    参照画像:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {editingEnhancedPromptQueue.images.map((img, idx) => (
                      <Tooltip key={idx} title={`${img.image_type}: ${img.name || img.reference_id}`}>
                        <Box
                          sx={{
                            width: 60,
                            height: 60,
                            borderRadius: 1,
                            overflow: 'hidden',
                            border: '2px solid',
                            borderColor:
                              img.image_type === 'character_sheet'
                                ? 'primary.main'
                                : img.image_type === 'scene'
                                ? 'info.main'
                                : img.image_type === 'output'
                                ? 'secondary.main'
                                : 'warning.main',
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
                              <ImageIcon />
                            </Box>
                          )}
                        </Box>
                      </Tooltip>
                    ))}
                  </Box>
                </Box>
              )}

              {/* enhanced_prompt編集 */}
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                Enhanced Prompt (AI生成/手動編集):
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={8}
                value={editingEnhancedPromptValue}
                onChange={(e) => setEditingEnhancedPromptValue(e.target.value)}
                placeholder="画像生成用のプロンプトを入力..."
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                  },
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                ※ このプロンプトが画像生成時に使用されます（enhance_prompt: enhance の場合）
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEnhancedPromptDialogOpen(false)} disabled={savingEnhancedPrompt}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleSaveEnhancedPrompt}
            disabled={savingEnhancedPrompt}
            startIcon={savingEnhancedPrompt ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
          >
            {savingEnhancedPrompt ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
