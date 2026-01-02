'use client';

import React, { useState } from 'react';
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
  Box,
  Typography,
  CircularProgress,
  Alert,
  Stack
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

interface ContinueConversationDialogProps {
  open: boolean;
  conversationId: number;
  onClose: () => void;
  onGenerated: () => void;
}

export default function ContinueConversationDialog({
  open,
  conversationId,
  onClose,
  onGenerated
}: ContinueConversationDialogProps) {
  const [messageCount, setMessageCount] = useState(4);
  const [tone, setTone] = useState<'casual' | 'formal' | 'dramatic' | 'humorous'>('casual');
  const [additionalContext, setAdditionalContext] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/conversations/${conversationId}/continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageCount,
          tone,
          additionalContext: additionalContext.trim() || undefined
        }),
      });

      const result = await response.json();

      if (result.success) {
        onGenerated();
        handleClose();
      } else {
        setError(result.error || '会話の続きの生成に失敗しました');
      }
    } catch (err) {
      console.error('Failed to continue conversation:', err);
      setError('会話の続きの生成に失敗しました');
    } finally {
      setGenerating(false);
    }
  };

  const handleClose = () => {
    if (generating) return;
    setMessageCount(4);
    setTone('casual');
    setAdditionalContext('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeIcon />
        会話の続きを生成
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary">
            既存の会話の流れを考慮して、自然な続きを生成します。
          </Typography>

          {/* 追加のコンテキスト */}
          <TextField
            label="追加の指示（オプション）"
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            multiline
            rows={3}
            fullWidth
            placeholder="例: ここで主人公が秘密を明かす、雰囲気が急に緊迫する、など"
            helperText="会話の展開について追加の指示があれば入力してください"
          />

          {/* トーン */}
          <FormControl fullWidth>
            <InputLabel>トーン</InputLabel>
            <Select
              value={tone}
              onChange={(e) => setTone(e.target.value as typeof tone)}
              label="トーン"
            >
              <MenuItem value="casual">カジュアル</MenuItem>
              <MenuItem value="formal">フォーマル</MenuItem>
              <MenuItem value="dramatic">ドラマティック</MenuItem>
              <MenuItem value="humorous">ユーモラス</MenuItem>
            </Select>
          </FormControl>

          {/* メッセージ数 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              生成するメッセージ数: {messageCount}
            </Typography>
            <Slider
              value={messageCount}
              onChange={(_, value) => setMessageCount(value as number)}
              min={1}
              max={10}
              step={1}
              marks
              valueLabelDisplay="auto"
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={generating}>
          キャンセル
        </Button>
        <Button
          onClick={handleGenerate}
          variant="contained"
          disabled={generating}
          startIcon={generating ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
        >
          {generating ? '生成中...' : '続きを生成'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
