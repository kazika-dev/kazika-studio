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
  Alert,
  Paper,
  Snackbar,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';

interface RapidNodeSettingsProps {
  node: Node;
  nodes: Node[];
  edges: Edge[];
  onClose: () => void;
  onUpdate: (nodeId: string, config: any) => void;
  onDelete: () => void;
}

export default function RapidNodeSettings({ node, nodes, edges, onClose, onUpdate, onDelete }: RapidNodeSettingsProps) {
  const [name, setName] = useState(node.data.config?.name || '');
  const [description, setDescription] = useState(node.data.config?.description || '');
  const [prompt, setPrompt] = useState(node.data.config?.prompt || '');
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
                        sourceNode.data.type === 'characterSheet' ||
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
  }, [node]);

  const handleSave = () => {
    console.log('Saving Rapid node config:', {
      nodeId: node.id,
      name,
      description,
      prompt,
      promptLength: prompt.length,
    });

    onUpdate(node.id, {
      name,
      description,
      prompt,
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
          <EditIcon sx={{ color: '#9c27b0' }} />
          <Typography variant="h6" fontWeight={600}>
            Rapid ノード設定
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
              label="Rapid 画像編集 (Qwen-Image-Edit)"
              sx={{
                bgcolor: 'rgba(156, 39, 176, 0.1)',
                color: '#9c27b0',
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

          {/* Rapid Configuration */}
          <Typography variant="subtitle2" fontWeight={600} color="text.primary">
            Rapid (ComfyUI) 設定
          </Typography>

          <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
            ComfyUI の Qwen-Image-Edit を使用して画像を編集します。環境変数 COMFYUI_URL の設定が必要です。
          </Alert>

          {/* Incoming Images Info */}
          {incomingImages.length > 0 ? (
            <Box>
              <Typography variant="subtitle2" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
                入力画像
              </Typography>
              <Alert
                severity={incomingImages.some(img => img.hasImage) ? "success" : "warning"}
                sx={{ fontSize: '0.875rem' }}
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
                    • {img.nodeName} {img.hasImage ? '✓ 画像あり' : '(画像なし)'}
                  </Typography>
                ))}
                <Typography variant="caption" sx={{ display: 'block', mt: 1, fontSize: '0.75rem' }}>
                  {incomingImages.some(img => img.hasImage)
                    ? '最初の画像が編集対象として使用されます'
                    : '⚠ 画像を提供するノードを接続してください'}
                </Typography>
              </Alert>
            </Box>
          ) : (
            <Alert severity="warning" sx={{ fontSize: '0.875rem' }}>
              画像入力ノードまたは画像生成ノードを接続してください。Rapidは入力画像が必要です。
            </Alert>
          )}

          <Box>
            <TextField
              label="画像編集指示（プロンプト）"
              fullWidth
              multiline
              rows={8}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              variant="outlined"
              placeholder="例：背景をビーチに変更して&#10;例：笑顔に変えて&#10;例：猫を追加して"
              helperText="日本語で編集指示を入力してください。Gemini APIが英語プロンプトに変換します。"
            />
            <Alert severity="info" sx={{ mt: 1, fontSize: '0.8rem' }}>
              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                編集可能な内容:
              </Typography>
              <Typography variant="caption" component="div" sx={{ fontSize: '0.75rem' }}>
                • 背景変更（「背景を〇〇に変えて」）<br />
                • 表情変更（「笑顔にして」「驚いた表情に」）<br />
                • オブジェクト追加/削除（「猫を追加」「帽子を消して」）<br />
                • スタイル変換（「アニメ風に」「水彩画風に」）
              </Typography>
            </Alert>
          </Box>

          {/* Image Display */}
          {node.data.config?.imageData && (
            <Box>
              <Typography variant="subtitle2" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
                編集後の画像
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
                  alt="Edited"
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
              bgcolor: '#9c27b0',
              '&:hover': {
                bgcolor: '#7b1fa2',
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
