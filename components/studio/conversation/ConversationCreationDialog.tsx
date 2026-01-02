'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Stack
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';

interface ConversationCreationDialogProps {
  open: boolean;
  sceneId: number | null;
  onClose: () => void;
  onCreated: (conversationId: number) => void;
}

export default function ConversationCreationDialog({
  open,
  sceneId,
  onClose,
  onCreated
}: ConversationCreationDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('タイトルを入力してください');
      return;
    }

    if (!sceneId) {
      setError('シーンが選択されていません');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          storySceneId: sceneId,
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        onCreated(result.data.conversation.id);
        handleClose();
      } else {
        setError(result.error || '会話の作成に失敗しました');
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
      setError('会話の作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ChatIcon />
        新しい会話を作成
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <TextField
            label="会話タイトル"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            required
            autoFocus
            placeholder="例: 放課後の教室での会話"
          />

          <TextField
            label="説明（任意）"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={2}
            fullWidth
            placeholder="この会話の簡単な説明"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={creating}>
          キャンセル
        </Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={creating || !title.trim()}
          startIcon={creating ? <CircularProgress size={20} /> : <ChatIcon />}
        >
          {creating ? '作成中...' : '作成'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
