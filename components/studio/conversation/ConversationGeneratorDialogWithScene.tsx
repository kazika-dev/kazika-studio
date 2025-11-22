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
import type { GenerateConversationRequest, ConversationPromptTemplate } from '@/types/conversation';

interface Character {
  id: number;
  name: string;
  image_url: string | null;
}

interface ConversationGeneratorDialogWithSceneProps {
  open: boolean;
  sceneId: number | null;
  onClose: () => void;
  onGenerated: (conversationId: number) => void;
}

export default function ConversationGeneratorDialogWithScene({
  open,
  sceneId,
  onClose,
  onGenerated
}: ConversationGeneratorDialogWithSceneProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [selectedCharacters, setSelectedCharacters] = useState<number[]>([]);
  const [title, setTitle] = useState('');
  const [situation, setSituation] = useState('');
  const [messageCount, setMessageCount] = useState(6);
  const [tone, setTone] = useState<'casual' | 'formal' | 'dramatic' | 'humorous'>('casual');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prompt templates
  const [templates, setTemplates] = useState<ConversationPromptTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (open) {
      loadCharacters();
      loadTemplates();
    }
  }, [open, sceneId]);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/conversation-prompt-templates');
      const result = await response.json();

      if (result.success && result.data?.templates) {
        setTemplates(result.data.templates);
        // Select default template if available
        const defaultTemplate = result.data.templates.find((t: ConversationPromptTemplate) => t.is_default);
        if (defaultTemplate) {
          setSelectedTemplateId(defaultTemplate.id);
        }
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

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

    if (!sceneId) {
      setError('シーンが選択されていません');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const request: GenerateConversationRequest = {
        storySceneId: sceneId,
        title: title.trim(),
        characterIds: selectedCharacters,
        situation: situation.trim(),
        messageCount,
        tone,
        promptTemplateId: selectedTemplateId,
      };

      const response = await fetch('/api/conversations/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      const result = await response.json();

      if (result.success && result.data) {
        onGenerated(result.data.conversationId);
        handleClose();
      } else {
        setError(result.error || '会話生成に失敗しました');
      }
    } catch (error) {
      console.error('Failed to generate conversation:', error);
      setError('会話生成に失敗しました');
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

  const toggleCharacter = (charId: number) => {
    if (selectedCharacters.includes(charId)) {
      setSelectedCharacters(selectedCharacters.filter(id => id !== charId));
    } else {
      setSelectedCharacters([...selectedCharacters, charId]);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeIcon />
        会話を生成
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* タイトル */}
          <TextField
            label="会話タイトル"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            required
            placeholder="例: 屋上での告白シーン"
          />

          {/* キャラクター選択 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              キャラクター選択 (最低2人)
            </Typography>
            {loadingCharacters ? (
              <CircularProgress size={24} />
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {characters.map((char) => (
                  <Chip
                    key={char.id}
                    label={char.name}
                    onClick={() => toggleCharacter(char.id)}
                    color={selectedCharacters.includes(char.id) ? 'primary' : 'default'}
                    variant={selectedCharacters.includes(char.id) ? 'filled' : 'outlined'}
                  />
                ))}
              </Box>
            )}
          </Box>

          {/* シチュエーション */}
          <TextField
            label="シチュエーション"
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            multiline
            rows={4}
            fullWidth
            required
            placeholder="例: 夕暮れの学校の屋上。主人公が意を決してヒロインに告白する。ヒロインは驚きながらも嬉しそうな表情を見せる。"
          />

          {/* トーン */}
          <FormControl fullWidth>
            <InputLabel>トーン</InputLabel>
            <Select
              value={tone}
              onChange={(e) => setTone(e.target.value as any)}
              label="トーン"
            >
              <MenuItem value="casual">カジュアル</MenuItem>
              <MenuItem value="formal">フォーマル</MenuItem>
              <MenuItem value="dramatic">ドラマティック</MenuItem>
              <MenuItem value="humorous">ユーモラス</MenuItem>
            </Select>
          </FormControl>

          {/* プロンプトテンプレート選択 */}
          <FormControl fullWidth>
            <InputLabel>プロンプトテンプレート</InputLabel>
            <Select
              value={selectedTemplateId || ''}
              onChange={(e) => setSelectedTemplateId(e.target.value ? Number(e.target.value) : undefined)}
              label="プロンプトテンプレート"
            >
              {templates.map((template) => (
                <MenuItem key={template.id} value={template.id}>
                  {template.name} {template.is_default && '(デフォルト)'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* メッセージ数 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              メッセージ数: {messageCount}
            </Typography>
            <Slider
              value={messageCount}
              onChange={(_, value) => setMessageCount(value as number)}
              min={2}
              max={20}
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
          disabled={generating || selectedCharacters.length < 2 || !title || !situation}
          startIcon={generating ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
        >
          {generating ? '生成中...' : '会話を生成'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
