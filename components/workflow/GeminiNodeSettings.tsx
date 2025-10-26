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
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

interface GeminiNodeSettingsProps {
  node: Node;
  onClose: () => void;
  onUpdate: (nodeId: string, config: any) => void;
}

export default function GeminiNodeSettings({ node, onClose, onUpdate }: GeminiNodeSettingsProps) {
  const [name, setName] = useState(node.data.config?.name || '');
  const [description, setDescription] = useState(node.data.config?.description || '');
  const [prompt, setPrompt] = useState(node.data.config?.prompt || '');
  const [model, setModel] = useState(node.data.config?.model || 'gemini-1.5-flash');

  useEffect(() => {
    setName(node.data.config?.name || '');
    setDescription(node.data.config?.description || '');
    setPrompt(node.data.config?.prompt || '');
    setModel(node.data.config?.model || 'gemini-1.5-flash');
  }, [node]);

  const handleSave = () => {
    onUpdate(node.id, {
      name,
      description,
      prompt,
      model,
      status: node.data.config?.status || 'idle',
      response: node.data.config?.response,
      error: node.data.config?.error,
    });
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
          <AutoAwesomeIcon sx={{ color: '#ea80fc' }} />
          <Typography variant="h6" fontWeight={600}>
            Gemini ノード設定
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
              label="Gemini AI"
              sx={{
                bgcolor: 'rgba(234, 128, 252, 0.1)',
                color: '#ea80fc',
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

          {/* Gemini Configuration */}
          <Typography variant="subtitle2" fontWeight={600} color="text.primary">
            Gemini 設定
          </Typography>

          <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
            APIキーは環境変数（.env.local）から自動的に読み込まれます
          </Alert>

          <TextField
            label="モデル"
            fullWidth
            select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            variant="outlined"
          >
            <MenuItem value="gemini-1.5-flash">Gemini 1.5 Flash</MenuItem>
            <MenuItem value="gemini-1.5-pro">Gemini 1.5 Pro</MenuItem>
            <MenuItem value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Experimental)</MenuItem>
          </TextField>

          <TextField
            label="プロンプト"
            fullWidth
            multiline
            rows={6}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            variant="outlined"
            placeholder="ここにプロンプトを入力してください..."
          />

          {/* Response Display */}
          {node.data.config?.response && (
            <Box>
              <Typography variant="subtitle2" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
                レスポンス
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: 'action.hover',
                  maxHeight: 300,
                  overflow: 'auto',
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {node.data.config.response}
                </Typography>
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
              bgcolor: '#ea80fc',
              '&:hover': {
                bgcolor: '#d500f9',
              },
            }}
          >
            保存
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
