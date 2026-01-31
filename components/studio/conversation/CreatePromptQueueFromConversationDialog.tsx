'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  Paper,
} from '@mui/material';
import QueueIcon from '@mui/icons-material/Queue';
import ImageIcon from '@mui/icons-material/Image';
import PersonIcon from '@mui/icons-material/Person';

interface CreatePromptQueueFromConversationDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId: number;
  conversationTitle: string;
  messageCount: number;
  onSuccess?: (result: CreateResult) => void;
}

interface CreateResult {
  created_count: number;
  error_count: number;
  total_messages: number;
  queues: Array<{
    queue_id: number;
    message_id: number;
    sequence_order: number;
    character_count: number;
  }>;
}

// Nanobanaモデルオプション
const MODEL_OPTIONS = [
  { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image (推奨・高速)' },
  { value: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image Preview (高品質・2K-4K)' },
];

// アスペクト比オプション
const ASPECT_RATIO_OPTIONS = [
  { value: '16:9', label: '16:9 (横長)' },
  { value: '9:16', label: '9:16 (縦長)' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '1:1', label: '1:1 (正方形)' },
];

export default function CreatePromptQueueFromConversationDialog({
  open,
  onClose,
  conversationId,
  conversationTitle,
  messageCount,
  onSuccess,
}: CreatePromptQueueFromConversationDialogProps) {
  const [model, setModel] = useState('gemini-2.5-flash-image');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [enhancePrompt, setEnhancePrompt] = useState<'none' | 'enhance'>('none');
  const [priority, setPriority] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);

  // テンプレートID=15を固定で使用
  const additionalTemplateId = 15;

  // ダイアログが開いたときにリセット
  useEffect(() => {
    if (open) {
      setModel('gemini-2.5-flash-image');
      setAspectRatio('16:9');
      setAdditionalPrompt('');
      setEnhancePrompt('none');
      setPriority(0);
      setError(null);
      setResult(null);
    }
  }, [open]);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/conversations/${conversationId}/create-prompt-queues`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          aspectRatio,
          additionalTemplateId,
          additionalPrompt: additionalPrompt.trim(),
          priority,
          enhancePrompt,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create prompt queues');
      }

      if (data.success) {
        setResult(data.data);
        if (onSuccess) {
          onSuccess(data.data);
        }
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Failed to create prompt queues:', err);
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    if (!creating) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { maxHeight: '90vh' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <QueueIcon color="primary" />
        <Typography variant="h6">プロンプトキューを作成</Typography>
      </DialogTitle>

      <DialogContent>
        {/* 会話情報 */}
        <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'action.hover' }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            対象の会話
          </Typography>
          <Typography variant="body1" fontWeight="bold">
            {conversationTitle}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Chip
              size="small"
              icon={<ImageIcon />}
              label={`${messageCount} メッセージ`}
              variant="outlined"
            />
          </Box>
        </Paper>

        {/* 結果表示 */}
        {result && (
          <Alert
            severity={result.error_count > 0 ? 'warning' : 'success'}
            sx={{ mb: 3 }}
          >
            <Typography variant="body2">
              {result.created_count} 件のプロンプトキューを作成しました
              {result.error_count > 0 && ` (${result.error_count} 件のエラー)`}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              シーンプロンプトを持つメッセージからキューを作成しました
            </Typography>
          </Alert>
        )}

        {/* エラー表示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* 設定フォーム（結果表示前のみ） */}
        {!result && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* モデル選択 */}
            <FormControl fullWidth>
              <InputLabel>モデル</InputLabel>
              <Select
                value={model}
                label="モデル"
                onChange={(e) => setModel(e.target.value)}
                disabled={creating}
              >
                {MODEL_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* アスペクト比選択 */}
            <FormControl fullWidth>
              <InputLabel>アスペクト比</InputLabel>
              <Select
                value={aspectRatio}
                label="アスペクト比"
                onChange={(e) => setAspectRatio(e.target.value)}
                disabled={creating}
              >
                {ASPECT_RATIO_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* プロンプト補完 */}
            <FormControl fullWidth>
              <InputLabel>プロンプト補完</InputLabel>
              <Select
                value={enhancePrompt}
                label="プロンプト補完"
                onChange={(e) => setEnhancePrompt(e.target.value as 'none' | 'enhance')}
                disabled={creating}
              >
                <MenuItem value="none">補完なし</MenuItem>
                <MenuItem value="enhance">AIで補完する</MenuItem>
              </Select>
            </FormControl>

            {/* 優先度 */}
            <TextField
              label="優先度"
              type="number"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
              disabled={creating}
              helperText="数値が大きいほど優先度が高くなります"
              fullWidth
            />

            {/* 追加プロンプト */}
            <TextField
              label="追加プロンプト（オプション）"
              value={additionalPrompt}
              onChange={(e) => setAdditionalPrompt(e.target.value)}
              disabled={creating}
              multiline
              rows={3}
              placeholder="全てのシーンに追加するプロンプトを入力..."
              fullWidth
            />

            {/* テンプレート使用の説明 */}
            <Alert severity="info" sx={{ mt: 1 }}>
              <Typography variant="caption">
                テキストテンプレート ID=15 の内容がプロンプトに自動追加されます。
                <br />
                各メッセージに紐づくキャラクターシートが参照画像として設定されます。
              </Typography>
            </Alert>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={creating}>
          {result ? '閉じる' : 'キャンセル'}
        </Button>
        {!result && (
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={20} /> : <QueueIcon />}
          >
            {creating ? '作成中...' : 'キューを作成'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
