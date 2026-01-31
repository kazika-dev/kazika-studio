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
  Divider
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import type { ConversationDraftParams, ConversationPromptTemplate } from '@/types/conversation';
import ModelSelector from './ModelSelector';
import { DEFAULT_CONVERSATION_MODEL } from '@/lib/vertex-ai/constants';

interface Character {
  id: number;
  name: string;
  image_url: string | null;
}

interface ConversationSettingsDialogProps {
  open: boolean;
  conversationId: number;
  conversationTitle?: string; // 現在の会話タイトル
  draftParams: ConversationDraftParams | null;
  isGenerated: boolean; // 会話が生成済みかどうか
  onClose: () => void;
  onSaved: () => void; // 設定保存後のコールバック
  onGenerated?: () => void; // 生成後のコールバック（未生成の場合のみ）
}

export default function ConversationSettingsDialog({
  open,
  conversationId,
  conversationTitle,
  draftParams,
  isGenerated,
  onClose,
  onSaved,
  onGenerated
}: ConversationSettingsDialogProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [selectedCharacters, setSelectedCharacters] = useState<number[]>(draftParams?.characterIds || []);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState(draftParams?.location || '');
  const [situation, setSituation] = useState(draftParams?.situation || '');
  const [messageCount, setMessageCount] = useState(draftParams?.messageCount || 6);
  const [tone, setTone] = useState<'casual' | 'formal' | 'dramatic' | 'humorous'>(draftParams?.tone || 'casual');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prompt templates
  const [templates, setTemplates] = useState<ConversationPromptTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>(draftParams?.promptTemplateId);

  // AI Model selection
  const [selectedModel, setSelectedModel] = useState<string>(draftParams?.model || DEFAULT_CONVERSATION_MODEL);

  useEffect(() => {
    if (open) {
      loadCharacters();
      loadTemplates();
      // Reset form with draft params
      setSelectedCharacters(draftParams?.characterIds || []);
      setTitle(conversationTitle || '');
      setLocation(draftParams?.location || '');
      setSituation(draftParams?.situation || '');
      setMessageCount(draftParams?.messageCount || 6);
      setTone(draftParams?.tone || 'casual');
      setSelectedTemplateId(draftParams?.promptTemplateId);
      setSelectedModel(draftParams?.model || DEFAULT_CONVERSATION_MODEL);
    }
  }, [open, draftParams, conversationTitle]);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/conversation-prompt-templates');
      const result = await response.json();

      if (result.success && result.data?.templates) {
        setTemplates(result.data.templates);
        // Select draft template if available, otherwise default
        if (!draftParams?.promptTemplateId) {
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

  const buildDraftParams = (): ConversationDraftParams => ({
    characterIds: selectedCharacters,
    location: location.trim(),
    situation: situation.trim(),
    messageCount,
    tone,
    promptTemplateId: selectedTemplateId,
    model: selectedModel,
  });

  // 設定を保存（生成しない）
  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const updateResponse = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || undefined,
          draftParams: buildDraftParams(),
        }),
      });

      const updateResult = await updateResponse.json();
      if (!updateResult.success) {
        setError(updateResult.error || '設定の保存に失敗しました');
        return;
      }

      onSaved();
      handleClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
      setError('設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // 設定を保存して会話を生成
  const handleGenerate = async () => {
    if (selectedCharacters.length < 2) {
      setError('最低2人のキャラクターを選択してください');
      return;
    }

    if (!situation.trim()) {
      setError('会話プロンプトを入力してください');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      // First, update the draft params and title
      const updateResponse = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || undefined,
          draftParams: buildDraftParams(),
        }),
      });

      const updateResult = await updateResponse.json();
      if (!updateResult.success) {
        setError(updateResult.error || '設定の保存に失敗しました');
        return;
      }

      // Then, generate the conversation
      const response = await fetch(`/api/conversations/${conversationId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (result.success && result.data) {
        onGenerated?.();
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

  // 選択されたキャラクター名を取得
  const getSelectedCharacterNames = () => {
    return selectedCharacters
      .map(id => characters.find(c => c.id === id)?.name)
      .filter(Boolean)
      .join('、');
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SettingsIcon />
        {isGenerated ? '会話設定' : '会話設定を編集して生成'}
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
            label="タイトル"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            placeholder="会話のタイトル"
            helperText="会話を識別するためのタイトル"
          />

          <Divider />

          {/* 登場人物 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              登場人物 {!isGenerated && '(最低2人)'}
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
            {selectedCharacters.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                選択中: {getSelectedCharacterNames()}
              </Typography>
            )}
          </Box>

          <Divider />

          {/* 場所 */}
          <TextField
            label="場所"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            fullWidth
            placeholder="例: 学校の屋上、夕暮れ時"
            helperText="シーンの舞台となる場所を入力してください"
          />

          {/* 会話プロンプト（シチュエーション） */}
          <TextField
            label="会話プロンプト"
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            multiline
            rows={4}
            fullWidth
            required={!isGenerated}
            placeholder="例: 主人公が意を決してヒロインに告白する。ヒロインは驚きながらも嬉しそうな表情を見せる。"
            helperText="会話の流れや状況を詳しく記述してください"
          />

          <Divider />

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
            disabled={generating || saving}
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
        <Button onClick={handleClose} disabled={generating || saving}>
          キャンセル
        </Button>
        {isGenerated ? (
          // 生成済みの場合は保存のみ
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
          >
            {saving ? '保存中...' : '設定を保存'}
          </Button>
        ) : (
          // 未生成の場合は保存と生成
          <>
            <Button
              onClick={handleSave}
              disabled={generating || saving}
              startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            >
              {saving ? '保存中...' : '下書きを保存'}
            </Button>
            <Button
              onClick={handleGenerate}
              variant="contained"
              disabled={generating || saving || selectedCharacters.length < 2 || !situation}
              startIcon={generating ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
            >
              {generating ? '生成中...' : '会話を生成'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
