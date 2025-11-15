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
}

interface ConversationGeneratorDialogStandaloneProps {
  open: boolean;
  onClose: () => void;
  onGenerated: (conversationId: number) => void;
}

export default function ConversationGeneratorDialogStandalone({
  open,
  onClose,
  onGenerated
}: ConversationGeneratorDialogStandaloneProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [selectedCharacters, setSelectedCharacters] = useState<number[]>([]);
  const [title, setTitle] = useState('');
  const [situation, setSituation] = useState('');
  const [messageCount, setMessageCount] = useState(6);
  const [tone, setTone] = useState<'casual' | 'formal' | 'dramatic' | 'humorous'>('casual');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadCharacters();
    }
  }, [open]);

  const loadCharacters = async () => {
    setLoadingCharacters(true);
    setError(null);
    try {
      const response = await fetch('/api/characters');
      const result = await response.json();

      if (result.success && result.data) {
        setCharacters(result.data.characters);
      } else {
        setError(result.error || 'キャラクターの読み込みに失敗しました');
      }
    } catch (error) {
      console.error('Failed to load characters:', error);
      setError('キャラクターの読み込みに失敗しました');
    } finally {
      setLoadingCharacters(false);
    }
  };

  const handleGenerate = async () => {
    if (selectedCharacters.length < 2) {
      setError('最低2人のキャラクターを選択してください');
      return;
    }

    if (!title.trim()) {
      setError('タイトルを入力してください');
      return;
    }

    if (!situation.trim()) {
      setError('シチュエーションを入力してください');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const request: GenerateConversationRequest = {
        // studioId is optional - API will handle it
        title: title.trim(),
        characterIds: selectedCharacters,
        situation: situation.trim(),
        messageCount,
        tone
      };

      const response = await fetch('/api/conversations/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      const result = await response.json();

      if (result.success && result.data) {
        onGenerated(result.data.conversationId);
        handleClose();
      } else {
        setError(result.error || '会話の生成に失敗しました');
      }
    } catch (error) {
      console.error('Failed to generate conversation:', error);
      setError('会話の生成に失敗しました');
    } finally {
      setGenerating(false);
    }
  };

  const handleClose = () => {
    setSelectedCharacters([]);
    setTitle('');
    setSituation('');
    setMessageCount(6);
    setTone('casual');
    setError(null);
    onClose();
  };

  const handleCharacterToggle = (characterId: number) => {
    setSelectedCharacters(prev =>
      prev.includes(characterId)
        ? prev.filter(id => id !== characterId)
        : [...prev, characterId]
    );
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeIcon />
          新しい会話を生成
        </Box>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Stack spacing={3} sx={{ mt: 2 }}>
          {/* Title */}
          <TextField
            label="会話のタイトル"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 放課後の図書室で"
            disabled={generating}
          />

          {/* Characters */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              キャラクター選択 (最低2人)
            </Typography>
            {loadingCharacters ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : characters.length === 0 ? (
              <Alert severity="warning">
                キャラクターが存在しません。先にキャラクターを作成してください。
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {characters.map((character) => (
                  <Chip
                    key={character.id}
                    label={character.name}
                    onClick={() => handleCharacterToggle(character.id)}
                    color={selectedCharacters.includes(character.id) ? 'primary' : 'default'}
                    variant={selectedCharacters.includes(character.id) ? 'filled' : 'outlined'}
                    disabled={generating}
                  />
                ))}
              </Box>
            )}
          </Box>

          {/* Situation */}
          <TextField
            label="シチュエーション"
            fullWidth
            multiline
            rows={3}
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="例: 図書室で静かに勉強をしている時、偶然同じ本を手に取った"
            disabled={generating}
          />

          {/* Message Count */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              メッセージ数: {messageCount}
            </Typography>
            <Slider
              value={messageCount}
              onChange={(_, value) => setMessageCount(value as number)}
              min={2}
              max={20}
              marks
              disabled={generating}
            />
          </Box>

          {/* Tone */}
          <FormControl fullWidth disabled={generating}>
            <InputLabel>トーン</InputLabel>
            <Select
              value={tone}
              onChange={(e) => setTone(e.target.value as typeof tone)}
              label="トーン"
            >
              <MenuItem value="casual">カジュアル</MenuItem>
              <MenuItem value="formal">フォーマル</MenuItem>
              <MenuItem value="dramatic">ドラマチック</MenuItem>
              <MenuItem value="humorous">ユーモラス</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={generating}>
          キャンセル
        </Button>
        <Button
          onClick={handleGenerate}
          variant="contained"
          disabled={generating || selectedCharacters.length < 2 || !title.trim() || !situation.trim()}
          startIcon={generating ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
        >
          {generating ? '生成中...' : '生成'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
