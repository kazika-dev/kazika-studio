'use client';

import { useState } from 'react';
import {
  Box,
  TextField,
  Typography,
  Button,
  Drawer,
  IconButton,
  Divider,
  Snackbar,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';

interface QwenImageNodeSettingsProps {
  nodeId: string;
  config: {
    name: string;
    description: string;
    prompt: string;
    status?: 'idle' | 'queued' | 'processing' | 'success' | 'error';
    queueItemId?: number;
    imageUrl?: string;
    error?: string;
  };
  onUpdate: (nodeId: string, config: any) => void;
  onClose?: () => void;
  onDelete?: () => void;
}

export default function QwenImageNodeSettings({
  nodeId,
  config,
  onUpdate,
  onClose,
  onDelete,
}: QwenImageNodeSettingsProps) {
  const [name, setName] = useState(config.name || '');
  const [description, setDescription] = useState(config.description || '');
  const [prompt, setPrompt] = useState(config.prompt || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = () => {
    console.log('Saving Qwen Image node config:', {
      nodeId,
      name,
      description,
      prompt,
    });

    onUpdate(nodeId, {
      name,
      description,
      prompt,
      status: config?.status || 'idle',
      queueItemId: config?.queueItemId,
      imageUrl: config?.imageUrl,
      error: config?.error,
    });

    setSaveSuccess(true);
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={true}
        onClose={onClose}
        sx={{
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 500 },
            p: 0,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ flex: 1 }}>
            Qwen Image 設定
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ p: 3, overflow: 'auto', flex: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              label="ノード名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              variant="outlined"
            />

            <TextField
              label="説明"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
              variant="outlined"
            />

            <TextField
              label="プロンプト"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              fullWidth
              multiline
              rows={6}
              variant="outlined"
              required
              helperText="画像生成のためのプロンプトを入力してください"
            />
          </Box>
        </Box>

        <Divider />

        <Box sx={{ p: 2, display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            fullWidth
            sx={{
              bgcolor: '#9c27b0',
              '&:hover': {
                bgcolor: '#7b1fa2',
              },
            }}
          >
            保存
          </Button>
          {onDelete && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={onDelete}
            >
              削除
            </Button>
          )}
        </Box>
      </Drawer>

      <Snackbar
        open={saveSuccess}
        autoHideDuration={2000}
        onClose={() => setSaveSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" onClose={() => setSaveSuccess(false)}>
          設定を保存しました
        </Alert>
      </Snackbar>
    </>
  );
}
