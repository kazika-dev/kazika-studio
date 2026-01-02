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
  Stack,
  Avatar
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

interface Character {
  id: number;
  name: string;
  image_url: string | null;
}

interface GenerateMessagesDialogProps {
  open: boolean;
  conversationId: number;
  characters: Character[];
  onClose: () => void;
  onGenerated: () => void;
}

export default function GenerateMessagesDialog({
  open,
  conversationId,
  characters,
  onClose,
  onGenerated
}: GenerateMessagesDialogProps) {
  const [selectedCharacters, setSelectedCharacters] = useState<number[]>([]);
  const [situation, setSituation] = useState('');
  const [messageCount, setMessageCount] = useState(6);
  const [tone, setTone] = useState<'casual' | 'formal' | 'dramatic' | 'humorous'>('casual');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedCharacters([]);
      setSituation('');
      setMessageCount(6);
      setTone('casual');
      setError(null);
    }
  }, [open]);

  const handleGenerate = async () => {
    if (selectedCharacters.length < 2) {
      setError('最低2人のキャラクターを選択してください');
      return;
    }

    if (!situation.trim()) {
      setError('シチュエーションを入力してください');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/conversations/${conversationId}/generate-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterIds: selectedCharacters,
          situation: situation.trim(),
          messageCount,
          tone
        })
      });

      const result = await response.json();

      if (result.success) {
        onGenerated();
        handleClose();
      } else {
        setError(result.error || '会話の生成に失敗しました');
      }
    } catch (err) {
      console.error('Failed to generate messages:', err);
      setError('会話の生成に失敗しました');
    } finally {
      setGenerating(false);
    }
  };

  const handleClose = () => {
    if (generating) return;
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
          AIで会話を生成
        </Box>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Stack spacing={3} sx={{ mt: 2 }}>
          {/* Characters */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              会話するキャラクター（2人以上選択）
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {characters.map(char => (
                <Chip
                  key={char.id}
                  avatar={<Avatar src={char.image_url || undefined}>{char.name.charAt(0)}</Avatar>}
                  label={char.name}
                  onClick={() => handleCharacterToggle(char.id)}
                  color={selectedCharacters.includes(char.id) ? 'primary' : 'default'}
                  variant={selectedCharacters.includes(char.id) ? 'filled' : 'outlined'}
                  disabled={generating}
                />
              ))}
            </Box>
            {selectedCharacters.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {selectedCharacters.length}人選択中
              </Typography>
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
            placeholder="例: 放課後の図書室で、二人は偶然出会った。窓からは夕日が差し込んでいる..."
            disabled={generating}
            helperText="会話が行われる状況を詳しく書いてください"
          />

          {/* Tone */}
          <FormControl fullWidth>
            <InputLabel>トーン</InputLabel>
            <Select
              value={tone}
              onChange={(e) => setTone(e.target.value as typeof tone)}
              label="トーン"
              disabled={generating}
            >
              <MenuItem value="casual">カジュアル</MenuItem>
              <MenuItem value="formal">フォーマル</MenuItem>
              <MenuItem value="dramatic">ドラマティック</MenuItem>
              <MenuItem value="humorous">ユーモラス</MenuItem>
            </Select>
          </FormControl>

          {/* Message Count */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              生成するメッセージ数: {messageCount}
            </Typography>
            <Slider
              value={messageCount}
              onChange={(_, value) => setMessageCount(value as number)}
              min={2}
              max={20}
              step={1}
              marks={[
                { value: 2, label: '2' },
                { value: 10, label: '10' },
                { value: 20, label: '20' }
              ]}
              valueLabelDisplay="auto"
              disabled={generating}
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
          disabled={generating || selectedCharacters.length < 2 || !situation.trim()}
          startIcon={generating ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
        >
          {generating ? '生成中...' : '会話を生成'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
