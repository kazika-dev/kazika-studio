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
import EditIcon from '@mui/icons-material/Edit';
import type { ConversationDraftParams, ConversationPromptTemplate } from '@/types/conversation';
import ModelSelector from './ModelSelector';
import { DEFAULT_CONVERSATION_MODEL } from '@/lib/vertex-ai/constants';

interface Character {
  id: number;
  name: string;
  image_url: string | null;
}

interface DraftEditDialogProps {
  open: boolean;
  conversationId: number;
  draftParams: ConversationDraftParams;
  onClose: () => void;
  onGenerated: () => void;
}

export default function DraftEditDialog({
  open,
  conversationId,
  draftParams,
  onClose,
  onGenerated
}: DraftEditDialogProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [selectedCharacters, setSelectedCharacters] = useState<number[]>(draftParams.characterIds || []);
  const [situation, setSituation] = useState(draftParams.situation || '');
  const [messageCount, setMessageCount] = useState(draftParams.messageCount || 6);
  const [tone, setTone] = useState<'casual' | 'formal' | 'dramatic' | 'humorous'>(draftParams.tone || 'casual');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prompt templates
  const [templates, setTemplates] = useState<ConversationPromptTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>(draftParams.promptTemplateId);

  // AI Model selection
  const [selectedModel, setSelectedModel] = useState<string>(draftParams.model || DEFAULT_CONVERSATION_MODEL);

  useEffect(() => {
    if (open) {
      loadCharacters();
      loadTemplates();
      // Reset form with draft params
      setSelectedCharacters(draftParams.characterIds || []);
      setSituation(draftParams.situation || '');
      setMessageCount(draftParams.messageCount || 6);
      setTone(draftParams.tone || 'casual');
      setSelectedTemplateId(draftParams.promptTemplateId);
      setSelectedModel(draftParams.model || DEFAULT_CONVERSATION_MODEL);
    }
  }, [open, draftParams]);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/conversation-prompt-templates');
      const result = await response.json();

      if (result.success && result.data?.templates) {
        setTemplates(result.data.templates);
        // Select draft template if available, otherwise default
        if (!selectedTemplateId) {
          const defaultTemplate = result.data.templates.find((t: ConversationPromptTemplate) => t.is_default);
          if (defaultTemplate) {
            setSelectedTemplateId(defaultTemplate.id);
          }
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

    if (!situation.trim()) {
      setError('シチュエーションを入力してください');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      // First, update the draft params
      const updateResponse = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftParams: {
            characterIds: selectedCharacters,
            situation: situation.trim(),
            messageCount,
            tone,
            promptTemplateId: selectedTemplateId,
            model: selectedModel,
          },
        }),
      });

      const updateResult = await updateResponse.json();
      if (!updateResult.success) {
        setError(updateResult.error || '下書きパラメータの更新に失敗しました');
        return;
      }

      // Then, generate the conversation
      const response = await fetch(`/api/conversations/${conversationId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (result.success && result.data) {
        onGenerated();
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
        <EditIcon />
        会話設定を編集して生成
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

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

          {/* AIモデル選択 */}
          <ModelSelector
            value={selectedModel}
            onChange={setSelectedModel}
            disabled={generating}
          />

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
          disabled={generating || selectedCharacters.length < 2 || !situation}
          startIcon={generating ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
        >
          {generating ? '生成中...' : '会話を生成'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
