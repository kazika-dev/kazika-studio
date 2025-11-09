'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  Chip,
  FormControl,
  InputLabel,
  Slider,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Stack
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import type { GenerateConversationRequest } from '@/types/conversation';

interface Character {
  id: number;
  name: string;
  image_url: string | null;
  personality: string | null;
  speaking_style: string | null;
}

interface ConversationGeneratorDialogProps {
  open: boolean;
  onClose: () => void;
  studioId: number;
  onGenerated: (conversationId: number) => void;
}

export default function ConversationGeneratorDialog({
  open,
  onClose,
  studioId,
  onGenerated
}: ConversationGeneratorDialogProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [selectedCharacters, setSelectedCharacters] = useState<number[]>([]);
  const [title, setTitle] = useState('');
  const [situation, setSituation] = useState('');
  const [messageCount, setMessageCount] = useState(10);
  const [tone, setTone] = useState<'casual' | 'formal' | 'dramatic' | 'humorous'>('casual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch characters when dialog opens
  useEffect(() => {
    if (open) {
      fetchCharacters();
      // Reset form
      setSelectedCharacters([]);
      setTitle('');
      setSituation('');
      setMessageCount(10);
      setTone('casual');
      setError(null);
    }
  }, [open]);

  const fetchCharacters = async () => {
    setLoadingCharacters(true);
    try {
      const response = await fetch('/api/character-sheets');
      const result = await response.json();

      if (result.success && result.characterSheets) {
        setCharacters(result.characterSheets);
      } else {
        setError('キャラクターの読み込みに失敗しました');
      }
    } catch (error) {
      console.error('Failed to fetch characters:', error);
      setError('キャラクターの読み込みに失敗しました');
    } finally {
      setLoadingCharacters(false);
    }
  };

  const handleGenerate = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const requestBody: GenerateConversationRequest = {
        studioId,
        title,
        characterIds: selectedCharacters,
        situation,
        messageCount,
        tone
      };

      const response = await fetch('/api/conversations/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();

      if (result.success && result.data) {
        onGenerated(result.data.conversationId);
        onClose();
      } else {
        setError(result.error || '会話生成に失敗しました');
      }
    } catch (error) {
      console.error('Failed to generate conversation:', error);
      setError('会話生成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      setError('タイトルを入力してください');
      return false;
    }
    if (selectedCharacters.length < 2) {
      setError('2名以上のキャラクターを選択してください');
      return false;
    }
    if (!situation.trim()) {
      setError('シチュエーションを入力してください');
      return false;
    }
    return true;
  };

  const toneLabels = {
    casual: 'カジュアル',
    formal: 'フォーマル',
    dramatic: 'ドラマチック',
    humorous: 'ユーモラス'
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeIcon />
        会話を生成
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <TextField
            label="タイトル"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 二人の出会い"
            required
          />

          <FormControl fullWidth required>
            <InputLabel>キャラクター選択 (2名以上)</InputLabel>
            <Select
              multiple
              value={selectedCharacters}
              onChange={(e) => setSelectedCharacters(e.target.value as number[])}
              disabled={loadingCharacters}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((id) => {
                    const char = characters.find((c) => c.id === id);
                    return (
                      <Chip
                        key={id}
                        label={char?.name || id}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    );
                  })}
                </Box>
              )}
            >
              {loadingCharacters ? (
                <MenuItem disabled>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  読み込み中...
                </MenuItem>
              ) : characters.length === 0 ? (
                <MenuItem disabled>
                  キャラクターが見つかりません
                </MenuItem>
              ) : (
                characters.map((char) => (
                  <MenuItem key={char.id} value={char.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography>{char.name}</Typography>
                      {char.personality && (
                        <Typography variant="caption" color="text.secondary">
                          {char.personality.substring(0, 30)}
                          {char.personality.length > 30 ? '...' : ''}
                        </Typography>
                      )}
                    </Box>
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          <TextField
            label="シチュエーション"
            fullWidth
            multiline
            rows={3}
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="例: 学校の屋上で、二人が夢について語り合う"
            required
          />

          <FormControl fullWidth>
            <InputLabel>会話の雰囲気</InputLabel>
            <Select value={tone} onChange={(e) => setTone(e.target.value as typeof tone)}>
              {Object.entries(toneLabels).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box>
            <Typography gutterBottom>
              メッセージ数: {messageCount}
            </Typography>
            <Slider
              value={messageCount}
              onChange={(_, val) => setMessageCount(val as number)}
              min={4}
              max={20}
              step={2}
              marks
              valueLabelDisplay="auto"
              sx={{ mt: 1 }}
            />
            <Typography variant="caption" color="text.secondary">
              生成される会話のやり取りの数を指定します
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          キャンセル
        </Button>
        <Button
          onClick={handleGenerate}
          variant="contained"
          disabled={loading || selectedCharacters.length < 2 || !title.trim() || !situation.trim()}
          startIcon={loading ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
        >
          {loading ? '生成中...' : '生成'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
