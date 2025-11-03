'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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
import ImageIcon from '@mui/icons-material/Image';
import UploadIcon from '@mui/icons-material/Upload';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';

interface NanobanaNodeSettingsProps {
  node: Node;
  nodes: Node[];
  edges: Edge[];
  onClose: () => void;
  onUpdate: (nodeId: string, config: any) => void;
  onDelete: () => void;
}

export default function NanobanaNodeSettings({ node, nodes, edges, onClose, onUpdate, onDelete }: NanobanaNodeSettingsProps) {
  const [name, setName] = useState(node.data.config?.name || '');
  const [description, setDescription] = useState(node.data.config?.description || '');
  const [prompt, setPrompt] = useState(node.data.config?.prompt || '');
  const [aspectRatio, setAspectRatio] = useState(node.data.config?.aspectRatio || '1:1');
  const [referenceImages, setReferenceImages] = useState<Array<{ mimeType: string; data: string }>>(
    node.data.config?.referenceImages || []
  );
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setAspectRatio(node.data.config?.aspectRatio || '1:1');
    setReferenceImages(node.data.config?.referenceImages || []);
  }, [node]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newImages: Array<{ mimeType: string; data: string }> = [];

    Array.from(files).forEach((file) => {
      // 画像ファイルのみ受け付ける
      if (!file.type.startsWith('image/')) {
        alert('画像ファイルのみアップロードできます');
        return;
      }

      // ファイルサイズチェック（5MB以下）
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} のサイズが5MBを超えています`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const base64Data = base64.split(',')[1];

        newImages.push({
          mimeType: file.type,
          data: base64Data,
        });

        // 全ての画像の読み込みが完了したら state を更新
        if (newImages.length === Array.from(files).filter(f => f.type.startsWith('image/')).length) {
          setReferenceImages([...referenceImages, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (index: number) => {
    setReferenceImages(referenceImages.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    console.log('Saving Nanobana node config:', {
      nodeId: node.id,
      name,
      description,
      prompt,
      promptLength: prompt.length,
      aspectRatio,
      referenceImagesCount: referenceImages.length,
    });

    onUpdate(node.id, {
      name,
      description,
      prompt,
      aspectRatio,
      referenceImages,
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

          <Divider />

          {/* Incoming Images Info */}
          {incomingImages.length > 0 && (
            <Box>
              <Typography variant="subtitle2" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
                上流ノードからの画像
              </Typography>
              <Alert
                severity={incomingImages.some(img => img.hasImage) ? "success" : "info"}
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
                  これらのノードから画像が参照画像として自動的に使用されます（最大3枚）
                </Typography>
              </Alert>
            </Box>
          )}

          {/* Reference Images Upload */}
          <Typography variant="subtitle2" fontWeight={600} color="text.primary">
            参照画像（オプション）
          </Typography>

          <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
            参照画像を追加すると、その画像のスタイルや要素を元に画像を生成します。画像サイズは各5MB以下にしてください。
          </Alert>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />

          <Button
            variant="outlined"
            fullWidth
            size="large"
            startIcon={<UploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              py: 1.5,
              textTransform: 'none',
              borderStyle: 'dashed',
              borderWidth: 2,
            }}
          >
            参照画像を追加
          </Button>

          {referenceImages.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                {referenceImages.length} 枚の参照画像
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {referenceImages.map((img, index) => (
                  <Box key={index} sx={{ width: 'calc(50% - 8px)' }}>
                    <Paper
                      variant="outlined"
                      sx={{
                        position: 'relative',
                        p: 1,
                        bgcolor: 'action.hover',
                      }}
                    >
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveImage(index)}
                        sx={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          bgcolor: 'background.paper',
                          '&:hover': {
                            bgcolor: 'error.light',
                            color: 'white',
                          },
                        }}
                      >
                        <CloseOutlinedIcon fontSize="small" />
                      </IconButton>
                      <img
                        src={`data:${img.mimeType};base64,${img.data}`}
                        alt={`Reference ${index + 1}`}
                        style={{
                          width: '100%',
                          height: '120px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                        }}
                      />
                    </Paper>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

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
