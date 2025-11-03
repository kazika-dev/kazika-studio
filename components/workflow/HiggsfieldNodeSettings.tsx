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
  FormControlLabel,
  Switch,
  Slider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';

interface HiggsfieldNodeSettingsProps {
  node: Node;
  nodes: Node[];
  edges: Edge[];
  onClose: () => void;
  onUpdate: (nodeId: string, config: any) => void;
  onDelete: () => void;
}

export default function HiggsfieldNodeSettings({ node, nodes, edges, onClose, onUpdate, onDelete }: HiggsfieldNodeSettingsProps) {
  const [name, setName] = useState(node.data.config?.name || '');
  const [description, setDescription] = useState(node.data.config?.description || '');
  const [prompt, setPrompt] = useState(node.data.config?.prompt || '');
  const [duration, setDuration] = useState(node.data.config?.duration || 5);
  const [cfgScale, setCfgScale] = useState(node.data.config?.cfgScale || 0.5);
  const [enhancePrompt, setEnhancePrompt] = useState(node.data.config?.enhancePrompt || false);
  const [negativePrompt, setNegativePrompt] = useState(node.data.config?.negativePrompt || '');
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
    setDuration(node.data.config?.duration || 5);
    setCfgScale(node.data.config?.cfgScale || 0.5);
    setEnhancePrompt(node.data.config?.enhancePrompt || false);
    setNegativePrompt(node.data.config?.negativePrompt || '');
  }, [node]);

  const handleSave = () => {
    console.log('Saving Higgsfield node config:', {
      nodeId: node.id,
      name,
      description,
      prompt,
      promptLength: prompt.length,
      duration,
      cfgScale,
      enhancePrompt,
      negativePrompt,
    });

    onUpdate(node.id, {
      name,
      description,
      prompt,
      duration,
      cfgScale,
      enhancePrompt,
      negativePrompt,
      status: node.data.config?.status || 'idle',
      videoUrl: node.data.config?.videoUrl,
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
          <VideoLibraryIcon sx={{ color: '#9c27b0' }} />
          <Typography variant="h6" fontWeight={600}>
            Higgsfield ノード設定
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
              label="Higgsfield 動画生成"
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

          {/* Higgsfield Configuration */}
          <Typography variant="subtitle2" fontWeight={600} color="text.primary">
            Higgsfield 設定
          </Typography>

          <Alert severity="warning" sx={{ fontSize: '0.875rem', mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
              ⚠️ 参照画像が必須です
            </Typography>
            <Typography variant="caption">
              このノードの前に画像生成ノード（Nanobana）または画像入力ノードを接続してください。
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
                  最初の画像が参照画像として使用されます
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
              placeholder="動画生成用のプロンプトを入力してください..."
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
            label="ネガティブプロンプト"
            fullWidth
            multiline
            rows={3}
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            variant="outlined"
            placeholder="除外したい要素を記述..."
          />

          <TextField
            label="動画の長さ"
            fullWidth
            select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            variant="outlined"
          >
            <MenuItem value={5}>5秒</MenuItem>
            <MenuItem value={10}>10秒</MenuItem>
          </TextField>

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              CFG Scale: {cfgScale.toFixed(1)}
            </Typography>
            <Slider
              value={cfgScale}
              onChange={(_, value) => setCfgScale(value as number)}
              min={0}
              max={1}
              step={0.1}
              marks={[
                { value: 0, label: '0' },
                { value: 0.5, label: '0.5' },
                { value: 1, label: '1' },
              ]}
              sx={{
                color: '#9c27b0',
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
              プロンプトに対する忠実度を調整します
            </Typography>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={enhancePrompt}
                onChange={(e) => setEnhancePrompt(e.target.checked)}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#9c27b0',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#9c27b0',
                  },
                }}
              />
            }
            label={
              <Box>
                <Typography variant="body2">プロンプト自動強化</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  AIがプロンプトを自動的に改善します
                </Typography>
              </Box>
            }
          />

          {/* Video Preview */}
          {node.data.config?.videoUrl && (
            <Box>
              <Typography variant="subtitle2" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
                動画プレビュー
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: 'action.hover',
                }}
              >
                <video
                  controls
                  style={{ width: '100%', maxHeight: '300px', borderRadius: '4px' }}
                  src={node.data.config.videoUrl}
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
