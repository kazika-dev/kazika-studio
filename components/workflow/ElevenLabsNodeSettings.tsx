'use client';

import { useState, useEffect } from 'react';
import { Node } from 'reactflow';
import {
  Box,
  Drawer,
  IconButton,
  Typography,
  TextField,
  Button,
  Divider,
  Stack,
  Chip,
  MenuItem,
  Alert,
  Paper,
  Snackbar,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';

interface CharacterSheet {
  id: number;
  name: string;
  elevenlabs_voice_id?: string;
}

interface ElevenLabsNodeSettingsProps {
  node: Node;
  onClose: () => void;
  onUpdate: (nodeId: string, config: any) => void;
  onDelete: () => void;
}

export default function ElevenLabsNodeSettings({ node, onClose, onUpdate, onDelete }: ElevenLabsNodeSettingsProps) {
  const [name, setName] = useState(node.data.config?.name || '');
  const [description, setDescription] = useState(node.data.config?.description || '');
  const [text, setText] = useState(node.data.config?.text || '');
  const [voiceId, setVoiceId] = useState(node.data.config?.voiceId || 'JBFqnCBsd6RMkjVDRZzb');
  const [modelId, setModelId] = useState(node.data.config?.modelId || 'eleven_turbo_v2_5');
  const [characters, setCharacters] = useState<CharacterSheet[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setName(node.data.config?.name || '');
    setDescription(node.data.config?.description || '');
    setText(node.data.config?.text || '');
    setVoiceId(node.data.config?.voiceId || 'JBFqnCBsd6RMkjVDRZzb');
    setModelId(node.data.config?.modelId || 'eleven_turbo_v2_5');
  }, [node]);

  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = async () => {
    try {
      const response = await fetch('/api/character-sheets');
      const data = await response.json();
      if (data.success) {
        console.log('[ElevenLabsNodeSettings] Loaded characters:', data.characterSheets);
        console.log('[ElevenLabsNodeSettings] Characters with voice IDs:',
          data.characterSheets.filter((c: CharacterSheet) => c.elevenlabs_voice_id)
        );
        setCharacters(data.characterSheets);
      }
    } catch (error) {
      console.error('Failed to load characters:', error);
    }
  };

  const handleSave = () => {
    console.log('Saving ElevenLabs node config:', {
      nodeId: node.id,
      name,
      description,
      text,
      textLength: text.length,
      voiceId,
      modelId,
    });

    onUpdate(node.id, {
      name,
      description,
      text,
      voiceId,
      modelId,
      status: node.data.config?.status || 'idle',
      audioData: node.data.config?.audioData,
      error: node.data.config?.error,
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <Drawer
      anchor="right"
      open={true}
      onClose={onClose}
      slotProps={{
        backdrop: {
          sx: { bgcolor: 'rgba(0, 0, 0, 0.3)' }
        }
      }}
      sx={{
        zIndex: 1300,
        '& .MuiDrawer-paper': {
          width: 450,
          bgcolor: 'background.default',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 3,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <RecordVoiceOverIcon sx={{ color: '#4fc3f7' }} />
          <Typography variant="h6" fontWeight={600}>
            ElevenLabs ノード設定
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ p: 3, overflow: 'auto' }}>
        <Stack spacing={3}>
          {/* Node Info */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              ノードID
            </Typography>
            <TextField
              fullWidth
              value={node.id}
              disabled
              size="small"
              slotProps={{
                input: {
                  sx: { fontFamily: 'monospace', fontSize: '0.875rem' },
                }
              }}
            />
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              ノードタイプ
            </Typography>
            <Chip
              label="ElevenLabs TTS"
              sx={{
                bgcolor: 'rgba(79, 195, 247, 0.1)',
                color: '#4fc3f7',
                fontWeight: 500,
              }}
            />
          </Box>

          <Divider />

          {/* Node Configuration */}
          <TextField
            label="名前"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            variant="outlined"
            size="medium"
          />

          <TextField
            label="説明"
            fullWidth
            multiline
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            variant="outlined"
          />

          <Divider />

          {/* ElevenLabs Configuration */}
          <Typography variant="subtitle2" fontWeight={600} color="text.primary">
            ElevenLabs 設定
          </Typography>

          <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
            APIキーは環境変数（.env.local）から自動的に読み込まれます
          </Alert>

          <TextField
            label="音声ID"
            fullWidth
            select
            value={voiceId}
            onChange={(e) => {
              console.log('[ElevenLabsNodeSettings] Voice ID changed:', e.target.value);
              setVoiceId(e.target.value);
            }}
            variant="outlined"
            helperText="プリセット音声またはカスタム音声（キャラクター登録済み）を選択"
          >
            {/* プリセット音声 */}
            <MenuItem disabled sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
              プリセット音声
            </MenuItem>
            <MenuItem value="JBFqnCBsd6RMkjVDRZzb">George (英語)</MenuItem>
            <MenuItem value="21m00Tcm4TlvDq8ikWAM">Rachel (英語)</MenuItem>
            <MenuItem value="AZnzlk1XvdvUeBnXmlld">Domi (英語)</MenuItem>
            <MenuItem value="EXAVITQu4vr4xnSDxMaL">Bella (英語)</MenuItem>
            <MenuItem value="ErXwobaYiN019PkySvjV">Antoni (英語)</MenuItem>
            <MenuItem value="MF3mGyEYCl7XYWbV9V6O">Elli (英語)</MenuItem>
            <MenuItem value="TxGEqnHWrfWFTfGW9XjX">Josh (英語)</MenuItem>
            <MenuItem value="VR6AewLTigWG4xSOukaG">Arnold (英語)</MenuItem>
            <MenuItem value="pNInz6obpgDQGcFmaJgB">Adam (英語)</MenuItem>
            <MenuItem value="yoZ06aMxZJJ28mfd3POQ">Sam (英語)</MenuItem>

            {/* キャラクターのカスタム音声 */}
            {characters.filter(c => c.elevenlabs_voice_id && c.elevenlabs_voice_id.trim()).length > 0 && [
              <Divider key="divider" sx={{ my: 1 }} />,
              <MenuItem key="header" disabled sx={{ fontWeight: 600, fontSize: '0.875rem', color: 'primary.main' }}>
                カスタム音声（キャラクター）
              </MenuItem>,
              ...characters
                .filter(c => c.elevenlabs_voice_id && c.elevenlabs_voice_id.trim())
                .map((char) => {
                  console.log('[ElevenLabsNodeSettings] Rendering custom voice:', {
                    charId: char.id,
                    name: char.name,
                    voiceId: char.elevenlabs_voice_id
                  });
                  return (
                    <MenuItem
                      key={`char-${char.id}`}
                      value={char.elevenlabs_voice_id}
                    >
                      {char.name} ({char.elevenlabs_voice_id})
                    </MenuItem>
                  );
                })
            ]}
          </TextField>

          <TextField
            label="モデル"
            fullWidth
            select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            variant="outlined"
            helperText="Turbo v2.5推奨（バランス型）、v3は最高品質だが要アクセス権"
          >
            <MenuItem value="eleven_turbo_v2_5">Turbo v2.5 (推奨・バランス型) ⭐</MenuItem>
            <MenuItem value="eleven_flash_v2_5">Flash v2.5 (超高速・低コスト)</MenuItem>
            <MenuItem value="eleven_multilingual_v2">Multilingual v2 (安定)</MenuItem>
            <MenuItem value="eleven_turbo_v2">Turbo v2 (高速)</MenuItem>
            <MenuItem value="eleven_monolingual_v1">Monolingual v1 (英語のみ)</MenuItem>
            <MenuItem value="eleven_v3">Eleven v3 (最高品質・Alpha・要アクセス権)</MenuItem>
          </TextField>

          <Box>
            <TextField
              label="テキスト"
              fullWidth
              multiline
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              variant="outlined"
              placeholder="音声に変換するテキストを入力してください..."
            />
            <Alert severity="info" sx={{ mt: 1, fontSize: '0.8rem' }}>
              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                前のノードの結果を参照できます：
              </Typography>
              <Typography variant="caption" component="div" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                • {`{{prev.response}}`} - 直前のノードの出力<br />
                • {`{{ノード名.response}}`} - 特定のノードの出力
              </Typography>
            </Alert>
          </Box>

          {/* Audio Preview */}
          {node.data.config?.audioData && (
            <Box>
              <Typography variant="subtitle2" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
                音声プレビュー
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: 'action.hover',
                }}
              >
                <audio
                  controls
                  style={{ width: '100%' }}
                  src={`data:${node.data.config.audioData.mimeType};base64,${node.data.config.audioData.data}`}
                />
              </Paper>
            </Box>
          )}

          {/* Error Display */}
          {node.data.config?.status === 'error' && node.data.config?.error && (
            <Alert severity="error">
              {node.data.config.error}
            </Alert>
          )}

          {/* Save Button */}
          <Button
            variant="contained"
            fullWidth
            size="large"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            sx={{
              mt: 2,
              py: 1.5,
              textTransform: 'none',
              fontWeight: 600,
              bgcolor: '#4fc3f7',
              '&:hover': {
                bgcolor: '#29b6f6',
              },
            }}
          >
            保存
          </Button>

          {/* Delete Button */}
          <Button
            variant="outlined"
            fullWidth
            size="large"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => {
              if (confirm('このノードを削除してもよろしいですか？')) {
                onDelete();
                onClose();
              }
            }}
            sx={{
              py: 1.5,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            ノードを削除
          </Button>
        </Stack>
      </Box>

      {/* 保存成功のスナックバー */}
      <Snackbar
        open={saveSuccess}
        autoHideDuration={2000}
        onClose={() => setSaveSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" sx={{ width: '100%' }}>
          設定を保存しました
        </Alert>
      </Snackbar>
    </Drawer>
  );
}
