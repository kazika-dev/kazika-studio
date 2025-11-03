'use client';

import { useState, useEffect, useMemo } from 'react';
import { Node, Edge } from 'reactflow';
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
import ImageSearchIcon from '@mui/icons-material/ImageSearch';

interface Seedream4NodeSettingsProps {
  node: Node;
  nodes: Node[];
  edges: Edge[];
  onClose: () => void;
  onUpdate: (nodeId: string, config: any) => void;
  onDelete: () => void;
}

export default function Seedream4NodeSettings({ node, nodes, edges, onClose, onUpdate, onDelete }: Seedream4NodeSettingsProps) {
  const [name, setName] = useState(node.data.config?.name || '');
  const [description, setDescription] = useState(node.data.config?.description || '');
  const [prompt, setPrompt] = useState(node.data.config?.prompt || '');
  const [aspectRatio, setAspectRatio] = useState(node.data.config?.aspectRatio || '4:3');
  const [quality, setQuality] = useState(node.data.config?.quality || 'basic');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 上流ノードから引き継ぐ画像を検出
  const incomingImages = useMemo(() => {
    const images: Array<{ nodeName: string; hasImage: boolean }> = [];
    const incomingEdges = edges.filter(edge => edge.target === node.id);

    incomingEdges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (sourceNode) {
        const nodeName = sourceNode.data.config?.name || sourceNode.id;
        // 画像を生成・提供するノードタイプをチェック
        const hasImage = sourceNode.data.type === 'imageInput' ||
                        sourceNode.data.type === 'nanobana' ||
                        sourceNode.data.type === 'seedream4' ||
                        (sourceNode.data.config?.imageData && true);
        images.push({ nodeName, hasImage });
      }
    });

    return images;
  }, [nodes, edges, node.id]);

  useEffect(() => {
    setName(node.data.config?.name || '');
    setDescription(node.data.config?.description || '');
    setPrompt(node.data.config?.prompt || '');
    setAspectRatio(node.data.config?.aspectRatio || '4:3');
    setQuality(node.data.config?.quality || 'basic');
  }, [node]);

  const handleSave = () => {
    console.log('Saving Seedream4 node config:', {
      nodeId: node.id,
      name,
      description,
      prompt,
      promptLength: prompt.length,
      aspectRatio,
      quality,
    });

    onUpdate(node.id, {
      name,
      description,
      prompt,
      aspectRatio,
      quality,
      status: node.data.config?.status || 'idle',
      imageUrl: node.data.config?.imageUrl,
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
          <ImageSearchIcon sx={{ color: '#ff9800' }} />
          <Typography variant="h6" fontWeight={600}>
            Seedream4 ノード設定
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
              label="Seedream4 画像生成"
              sx={{
                bgcolor: 'rgba(255, 152, 0, 0.1)',
                color: '#ff9800',
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

          {/* Seedream4 Configuration */}
          <Typography variant="subtitle2" fontWeight={600} color="text.primary">
            Seedream4 設定
          </Typography>

          <Alert severity="warning" sx={{ fontSize: '0.875rem', mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
              ⚠️ 参照画像が必須です
            </Typography>
            <Typography variant="caption">
              このノードの前に画像生成ノード（Nanobana）または画像入力ノードを接続してください（最大8枚）。
            </Typography>
          </Alert>

          {/* Incoming Images Info */}
          {incomingImages.length > 0 && (
            <Alert
              severity={incomingImages.some(img => img.hasImage) ? "success" : "warning"}
              sx={{ fontSize: '0.875rem', mb: 2 }}
            >
              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                接続されているノード:
              </Typography>
              {incomingImages.map((img, index) => (
                <Typography
                  key={index}
                  variant="caption"
                  sx={{ display: 'block', fontFamily: 'monospace', fontSize: '0.75rem' }}
                >
                  • {img.nodeName} {img.hasImage ? '✓ 画像あり' : '⚠ 画像なし'}
                </Typography>
              ))}
              {incomingImages.some(img => img.hasImage) && (
                <Typography variant="caption" sx={{ display: 'block', mt: 1, fontSize: '0.75rem' }}>
                  これらのノードから画像が参照画像として自動的に使用されます（最大8枚）
                </Typography>
              )}
            </Alert>
          )}

          <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
            APIキー（HIGGSFIELD_API_KEY）とシークレット（HIGGSFIELD_SECRET）は環境変数から自動的に読み込まれます
          </Alert>

          <Box>
            <TextField
              label="プロンプト"
              fullWidth
              multiline
              rows={6}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              variant="outlined"
              placeholder="画像生成用のプロンプトを入力してください..."
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

          <TextField
            label="アスペクト比"
            fullWidth
            select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            variant="outlined"
          >
            <MenuItem value="1:1">1:1 (正方形)</MenuItem>
            <MenuItem value="4:3">4:3</MenuItem>
            <MenuItem value="16:9">16:9 (横長)</MenuItem>
            <MenuItem value="3:2">3:2</MenuItem>
            <MenuItem value="21:9">21:9 (超横長)</MenuItem>
            <MenuItem value="3:4">3:4 (縦長)</MenuItem>
            <MenuItem value="9:16">9:16 (縦長)</MenuItem>
            <MenuItem value="2:3">2:3</MenuItem>
          </TextField>

          <TextField
            label="品質"
            fullWidth
            select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            variant="outlined"
          >
            <MenuItem value="basic">Basic（基本）</MenuItem>
            <MenuItem value="high">High（高品質）</MenuItem>
          </TextField>

          {/* Image Preview */}
          {node.data.config?.imageUrl && (
            <Box>
              <Typography variant="subtitle2" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
                生成された画像
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: 'action.hover',
                }}
              >
                <img
                  style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', borderRadius: '4px' }}
                  src={node.data.config.imageUrl}
                  alt="Generated"
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
              bgcolor: '#ff9800',
              '&:hover': {
                bgcolor: '#f57c00',
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
