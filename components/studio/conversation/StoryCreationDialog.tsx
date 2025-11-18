'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  CircularProgress,
} from '@mui/material';

interface StoryCreationDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (storyId: number) => void;
}

export default function StoryCreationDialog({
  open,
  onClose,
  onCreated,
}: StoryCreationDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      alert('ストーリーのタイトルを入力してください');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        setTitle('');
        setDescription('');
        onCreated(result.data.story.id);
        onClose();
      } else {
        alert(`ストーリーの作成に失敗しました: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to create story:', error);
      alert('ストーリーの作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>新しいストーリーを作成</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="タイトル"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            fullWidth
            autoFocus
          />
          <TextField
            label="説明"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={3}
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={creating}>
          キャンセル
        </Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={creating || !title.trim()}
        >
          {creating ? <CircularProgress size={24} /> : '作成'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
