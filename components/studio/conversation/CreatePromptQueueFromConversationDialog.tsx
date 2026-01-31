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
  Checkbox,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import QueueIcon from '@mui/icons-material/Queue';
import ImageIcon from '@mui/icons-material/Image';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import DeselectIcon from '@mui/icons-material/Deselect';

interface MessageInfo {
  id: number;
  speaker_name: string;
  message_text: string;
  sequence_order: number;
}

interface CreatePromptQueueFromConversationDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId: number;
  conversationTitle: string;
  messages: MessageInfo[];
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

// プロンプト補完用AIモデルオプション (Vertex AI / Google Generative AI SDK)
const ENHANCE_MODEL_OPTIONS = [
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro (最新・高性能)' },
  { value: 'gemini-2.5-pro-preview-05-06', label: 'Gemini 2.5 Pro (高性能)' },
  { value: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash (高速・推奨)' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
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
  messages,
  onSuccess,
}: CreatePromptQueueFromConversationDialogProps) {
  const [selectedMessageIds, setSelectedMessageIds] = useState<number[]>([]);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [enhancePrompt, setEnhancePrompt] = useState<'none' | 'enhance'>('enhance');
  const [enhanceModel, setEnhanceModel] = useState('gemini-2.5-flash-preview-05-20');
  const [priority, setPriority] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);

  // テンプレートID=15を固定で使用
  const additionalTemplateId = 15;

  // ダイアログが開いたときにリセット
  useEffect(() => {
    if (open) {
      // 全メッセージを選択状態にする
      setSelectedMessageIds(messages.map(m => m.id));
      setAspectRatio('9:16');
      setAdditionalPrompt('');
      setEnhancePrompt('enhance');
      setEnhanceModel('gemini-2.5-flash-preview-05-20');
      setPriority(0);
      setError(null);
      setResult(null);
    }
  }, [open, messages]);

  const handleToggleMessage = (messageId: number) => {
    setSelectedMessageIds(prev =>
      prev.includes(messageId)
        ? prev.filter(id => id !== messageId)
        : [...prev, messageId]
    );
  };

  const handleSelectAll = () => {
    setSelectedMessageIds(messages.map(m => m.id));
  };

  const handleDeselectAll = () => {
    setSelectedMessageIds([]);
  };

  const handleCreate = async () => {
    if (selectedMessageIds.length === 0) {
      setError('少なくとも1つのメッセージを選択してください');
      return;
    }

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
          messageIds: selectedMessageIds,
          aspectRatio,
          additionalTemplateId,
          additionalPrompt: additionalPrompt.trim(),
          priority,
          enhancePrompt,
          enhanceModel: enhancePrompt === 'enhance' ? enhanceModel : undefined,
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

  // メッセージテキストを短く表示
  const truncateText = (text: string, maxLength: number = 50) => {
    // 感情タグを除去
    const cleanText = text.replace(/^\[[\w-]+\]\s*/, '');
    if (cleanText.length <= maxLength) return cleanText;
    return cleanText.substring(0, maxLength) + '...';
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
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
              label={`${selectedMessageIds.length} / ${messages.length} メッセージ選択中`}
              variant="outlined"
              color={selectedMessageIds.length > 0 ? 'primary' : 'default'}
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
              選択したメッセージからキューを作成しました
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
            {/* メッセージ選択 */}
            <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
              <Box sx={{ p: 1, display: 'flex', gap: 1, borderBottom: 1, borderColor: 'divider', position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                <Button
                  size="small"
                  startIcon={<SelectAllIcon />}
                  onClick={handleSelectAll}
                  disabled={creating}
                >
                  全選択
                </Button>
                <Button
                  size="small"
                  startIcon={<DeselectIcon />}
                  onClick={handleDeselectAll}
                  disabled={creating}
                >
                  全解除
                </Button>
              </Box>
              <List dense disablePadding>
                {messages.map((msg, index) => (
                  <ListItem key={msg.id} disablePadding divider={index < messages.length - 1}>
                    <ListItemButton
                      onClick={() => handleToggleMessage(msg.id)}
                      disabled={creating}
                      dense
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Checkbox
                          edge="start"
                          checked={selectedMessageIds.includes(msg.id)}
                          tabIndex={-1}
                          disableRipple
                          size="small"
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={msg.sequence_order + 1}
                              size="small"
                              sx={{ minWidth: 32, height: 20, fontSize: '0.7rem' }}
                            />
                            <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 80 }}>
                              {msg.speaker_name}
                            </Typography>
                          </Box>
                        }
                        secondary={truncateText(msg.message_text)}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Paper>

            <Divider />

            {/* アスペクト比選択 */}
            <FormControl fullWidth size="small">
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
            <FormControl fullWidth size="small">
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

            {/* プロンプト補完モデル選択（補完する場合のみ表示） */}
            {enhancePrompt === 'enhance' && (
              <FormControl fullWidth size="small">
                <InputLabel>補完用AIモデル</InputLabel>
                <Select
                  value={enhanceModel}
                  label="補完用AIモデル"
                  onChange={(e) => setEnhanceModel(e.target.value)}
                  disabled={creating}
                >
                  {ENHANCE_MODEL_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* 優先度 */}
            <TextField
              label="優先度"
              type="number"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
              disabled={creating}
              helperText="数値が大きいほど優先度が高くなります"
              fullWidth
              size="small"
            />

            {/* 追加プロンプト */}
            <TextField
              label="追加プロンプト（オプション）"
              value={additionalPrompt}
              onChange={(e) => setAdditionalPrompt(e.target.value)}
              disabled={creating}
              multiline
              rows={2}
              placeholder="全てのシーンに追加するプロンプトを入力..."
              fullWidth
              size="small"
            />

            {/* テンプレート使用の説明 */}
            <Alert severity="info" sx={{ py: 0.5 }}>
              <Typography variant="caption">
                テキストテンプレート ID=15 の内容がプロンプトに自動追加されます。
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
            disabled={creating || selectedMessageIds.length === 0}
            startIcon={creating ? <CircularProgress size={20} /> : <QueueIcon />}
          >
            {creating ? '作成中...' : `キューを作成 (${selectedMessageIds.length}件)`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
