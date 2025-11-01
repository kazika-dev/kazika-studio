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
import ImageIcon from '@mui/icons-material/Image';

interface NanobanaNodeSettingsProps {
  node: Node;
  onClose: () => void;
  onUpdate: (nodeId: string, config: any) => void;
  onDelete: () => void;
}

export default function NanobanaNodeSettings({ node, onClose, onUpdate, onDelete }: NanobanaNodeSettingsProps) {
  const [name, setName] = useState(node.data.config?.name || '');
  const [description, setDescription] = useState(node.data.config?.description || '');
  const [prompt, setPrompt] = useState(node.data.config?.prompt || '');
  const [aspectRatio, setAspectRatio] = useState(node.data.config?.aspectRatio || '1:1');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setName(node.data.config?.name || '');
    setDescription(node.data.config?.description || '');
    setPrompt(node.data.config?.prompt || '');
    setAspectRatio(node.data.config?.aspectRatio || '1:1');
  }, [node]);

  const handleSave = () => {
    console.log('Saving Nanobana node config:', {
      nodeId: node.id,
      name,
      description,
      prompt,
      promptLength: prompt.length,
      aspectRatio,
    });

    onUpdate(node.id, {
      name,
      description,
      prompt,
      aspectRatio,
      status: node.data.config?.status || 'idle',
      imageData: node.data.config?.imageData,
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
          <ImageIcon sx={{ color: '#ff6b9d' }} />
          <Typography variant="h6" fontWeight={600}>
            Nanobana ノード設定
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
              label="Nanobana 画像生成"
              sx={{
                bgcolor: 'rgba(255, 107, 157, 0.1)',
                color: '#ff6b9d',
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

          {/* Nanobana Configuration */}
          <Typography variant="subtitle2" fontWeight={600} color="text.primary">
            Nanobana 設定
          </Typography>

          <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
            Gemini 2.5 Flash Image モデルを使用します。APIキーは環境変数から読み込まれます。
          </Alert>

          <TextField
            label="アスペクト比"
            fullWidth
            select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            variant="outlined"
            helperText="生成する画像のアスペクト比を選択"
          >
            <MenuItem value="1:1">1:1 (正方形)</MenuItem>
            <MenuItem value="16:9">16:9 (横長・ワイド)</MenuItem>
            <MenuItem value="9:16">9:16 (縦長・ポートレート)</MenuItem>
            <MenuItem value="4:3">4:3 (横長・標準)</MenuItem>
            <MenuItem value="3:4">3:4 (縦長・標準)</MenuItem>
            <MenuItem value="3:2">3:2 (横長・写真)</MenuItem>
            <MenuItem value="2:3">2:3 (縦長・写真)</MenuItem>
          </TextField>

          <Box>
            <TextField
              label="画像生成プロンプト"
              fullWidth
              multiline
              rows={6}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              variant="outlined"
              placeholder="生成したい画像の説明を入力してください..."
              helperText="プロンプトは英語で記述することを推奨します"
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

          {/* Image Display */}
          {node.data.config?.imageData && (
            <Box>
              <Typography variant="subtitle2" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
                生成された画像
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: 'action.hover',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <img
                  src={`data:${node.data.config.imageData.mimeType};base64,${node.data.config.imageData.data}`}
                  alt="Generated"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '400px',
                    objectFit: 'contain',
                    borderRadius: '8px',
                  }}
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
              bgcolor: '#ff6b9d',
              '&:hover': {
                bgcolor: '#ff4081',
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
