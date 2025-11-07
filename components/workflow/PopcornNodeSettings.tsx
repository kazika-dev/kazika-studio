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
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';

interface PopcornNodeSettingsProps {
  node: Node;
  nodes: Node[];
  edges: Edge[];
  onClose: () => void;
  onUpdate: (nodeId: string, config: any) => void;
  onDelete: () => void;
}

export default function PopcornNodeSettings({
  node,
  nodes,
  edges,
  onClose,
  onUpdate,
  onDelete
}: PopcornNodeSettingsProps) {
  const [name, setName] = useState(node.data.config?.name || '');
  const [description, setDescription] = useState(node.data.config?.description || '');
  const [prompt, setPrompt] = useState(node.data.config?.prompt || '');
  const [aspectRatio, setAspectRatio] = useState(node.data.config?.aspectRatio || '3:4');
  const [count, setCount] = useState(node.data.config?.count || 1);
  const [quality, setQuality] = useState(node.data.config?.quality || '720p');
  const [seed, setSeed] = useState(node.data.config?.seed || '');
  const [presetId, setPresetId] = useState(node.data.config?.presetId || '');
  const [enhancePrompt, setEnhancePrompt] = useState(node.data.config?.enhancePrompt || false);
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
                        sourceNode.data.type === 'popcorn' ||
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
    setAspectRatio(node.data.config?.aspectRatio || '3:4');
    setCount(node.data.config?.count || 1);
    setQuality(node.data.config?.quality || '720p');
    setSeed(node.data.config?.seed || '');
    setPresetId(node.data.config?.presetId || '');
    setEnhancePrompt(node.data.config?.enhancePrompt || false);
  }, [node]);

  const handleSave = () => {
    console.log('Saving Popcorn node config:', {
      nodeId: node.id,
      name,
      description,
      prompt,
      promptLength: prompt.length,
      aspectRatio,
      count,
      quality,
      seed,
    });

    onUpdate(node.id, {
      name,
      description,
      prompt,
      aspectRatio,
      count,
      quality,
      seed: seed ? Number(seed) : undefined,
      presetId,
      enhancePrompt,
      status: node.data.config?.status || 'idle',
      imageUrls: node.data.config?.imageUrls,
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
          <ImageIcon sx={{ color: '#ff6b6b' }} />
          <Typography variant="h6" fontWeight={600}>
            Popcorn ノード設定
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
              label="Popcorn 画像生成"
              sx={{
                bgcolor: 'rgba(255, 107, 107, 0.1)',
                color: '#ff6b6b',
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

          {/* Popcorn Configuration */}
          <Typography variant="subtitle2" fontWeight={600} color="text.primary">
            Popcorn 設定
          </Typography>

          {/* Incoming Images Info */}
          {incomingImages.length > 0 && (
            <Alert severity="info" sx={{ fontSize: '0.875rem', mb: 2 }}>
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
              {incomingImages.some(img => img.hasImage) && (
                <Typography variant="caption" sx={{ display: 'block', mt: 1, fontSize: '0.75rem' }}>
                  参照画像として使用されます（最大8枚、オプショナル）
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
              required
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
            <MenuItem value="3:4">3:4</MenuItem>
            <MenuItem value="2:3">2:3</MenuItem>
            <MenuItem value="3:2">3:2</MenuItem>
            <MenuItem value="9:16">9:16</MenuItem>
            <MenuItem value="1:1">1:1</MenuItem>
            <MenuItem value="4:3">4:3</MenuItem>
            <MenuItem value="16:9">16:9</MenuItem>
          </TextField>

          <TextField
            label="生成枚数"
            fullWidth
            select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            variant="outlined"
            helperText="一度に生成する画像の枚数（最大4枚）"
          >
            <MenuItem value={1}>1枚</MenuItem>
            <MenuItem value={2}>2枚</MenuItem>
            <MenuItem value={3}>3枚</MenuItem>
            <MenuItem value={4}>4枚</MenuItem>
          </TextField>

          <TextField
            label="画質"
            fullWidth
            select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            variant="outlined"
          >
            <MenuItem value="720p">720p（標準）</MenuItem>
            <MenuItem value="1600p">1600p（高品質）</MenuItem>
          </TextField>

          <TextField
            label="シード値（オプショナル）"
            fullWidth
            type="number"
            value={seed}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || (Number(value) >= 1 && Number(value) <= 1000000)) {
                setSeed(value);
              }
            }}
            variant="outlined"
            placeholder="1-1000000"
            helperText="同じシード値を使うと同じ画像が生成されます"
            inputProps={{
              min: 1,
              max: 1000000,
            }}
          />

          <TextField
            label="プリセットID（オプショナル）"
            fullWidth
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            variant="outlined"
            placeholder="例: bc8c784e-dfab-4255-9952-e1a947a94983"
            helperText="Higgsfieldのスタイルプリセットを指定"
          />

          <FormControlLabel
            control={
              <Switch
                checked={enhancePrompt}
                onChange={(e) => setEnhancePrompt(e.target.checked)}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#ff6b6b',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#ff6b6b',
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

          {/* Image Preview */}
          {node.data.config?.imageUrls && node.data.config.imageUrls.length > 0 && (
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
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 1,
                  }}
                >
                  {node.data.config.imageUrls.map((url: string, index: number) => (
                    <Box
                      key={index}
                      sx={{
                        position: 'relative',
                        paddingBottom: '100%',
                        borderRadius: 1,
                        overflow: 'hidden',
                      }}
                    >
                      <img
                        src={url}
                        alt={`Generated ${index + 1}`}
                        style={{
                          position: 'absolute',
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    </Box>
                  ))}
                </Box>
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
              bgcolor: '#ff6b6b',
              '&:hover': {
                bgcolor: '#ee5a5a',
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
