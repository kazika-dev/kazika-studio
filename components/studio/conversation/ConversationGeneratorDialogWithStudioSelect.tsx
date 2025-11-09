'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  CircularProgress,
  Alert
} from '@mui/material';
import ConversationGeneratorDialog from './ConversationGeneratorDialog';

interface Studio {
  id: number;
  name: string;
  description: string;
}

interface ConversationGeneratorDialogWithStudioSelectProps {
  open: boolean;
  onClose: () => void;
  onGenerated: (conversationId: number) => void;
}

export default function ConversationGeneratorDialogWithStudioSelect({
  open,
  onClose,
  onGenerated
}: ConversationGeneratorDialogWithStudioSelectProps) {
  const [studios, setStudios] = useState<Studio[]>([]);
  const [selectedStudioId, setSelectedStudioId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGeneratorDialog, setShowGeneratorDialog] = useState(false);

  useEffect(() => {
    if (open) {
      loadStudios();
    }
  }, [open]);

  const loadStudios = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/studios');
      const result = await response.json();

      if (result.success && result.data) {
        setStudios(result.data.studios);
        // Auto-select if only one studio
        if (result.data.studios.length === 1) {
          setSelectedStudioId(result.data.studios[0].id);
        }
      } else {
        setError(result.error || 'スタジオの読み込みに失敗しました');
      }
    } catch (error) {
      console.error('Failed to load studios:', error);
      setError('スタジオの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (selectedStudioId) {
      setShowGeneratorDialog(true);
    }
  };

  const handleGeneratorClose = () => {
    setShowGeneratorDialog(false);
    onClose();
  };

  const handleGenerated = (conversationId: number) => {
    setShowGeneratorDialog(false);
    onGenerated(conversationId);
  };

  if (showGeneratorDialog && selectedStudioId) {
    return (
      <ConversationGeneratorDialog
        open={showGeneratorDialog}
        onClose={handleGeneratorClose}
        studioId={selectedStudioId}
        onGenerated={handleGenerated}
      />
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>新しい会話を生成 - スタジオ選択</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : studios.length === 0 ? (
          <Alert severity="warning">
            スタジオが存在しません。先にスタジオを作成してください。
          </Alert>
        ) : (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              会話を生成するスタジオを選択してください
            </Typography>
            <FormControl fullWidth>
              <InputLabel>スタジオ</InputLabel>
              <Select
                value={selectedStudioId || ''}
                onChange={(e) => setSelectedStudioId(e.target.value as number)}
                label="スタジオ"
              >
                {studios.map((studio) => (
                  <MenuItem key={studio.id} value={studio.id}>
                    {studio.name}
                    {studio.description && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 1 }}
                      >
                        - {studio.description}
                      </Typography>
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          onClick={handleContinue}
          variant="contained"
          disabled={!selectedStudioId || loading}
        >
          次へ
        </Button>
      </DialogActions>
    </Dialog>
  );
}
