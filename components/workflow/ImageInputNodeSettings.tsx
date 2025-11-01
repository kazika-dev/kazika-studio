'use client';

import { useState, useEffect, useRef } from 'react';
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
  Paper,
  Alert,
  Snackbar,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import UploadIcon from '@mui/icons-material/Upload';

interface ImageInputNodeSettingsProps {
  node: Node;
  onClose: () => void;
  onUpdate: (nodeId: string, config: any) => void;
  onDelete: () => void;
}

export default function ImageInputNodeSettings({ node, onClose, onUpdate, onDelete }: ImageInputNodeSettingsProps) {
  const [name, setName] = useState(node.data.config?.name || '');
  const [description, setDescription] = useState(node.data.config?.description || '');
  const [imageData, setImageData] = useState<{ mimeType: string; data: string } | null>(
    node.data.config?.imageData || null
  );
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(node.data.config?.name || '');
    setDescription(node.data.config?.description || '');
    setImageData(node.data.config?.imageData || null);
  }, [node]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 画像ファイルのみ受け付ける
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルのみアップロードできます');
      return;
    }

    // ファイルサイズチェック（5MB以下）
    if (file.size > 5 * 1024 * 1024) {
      alert('ファイルサイズは5MB以下にしてください');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      // data:image/png;base64, の部分を削除
      const base64Data = base64.split(',')[1];

      setImageData({
        mimeType: file.type,
        data: base64Data,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    onUpdate(node.id, {
      name,
      description,
      imageData,
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleRemoveImage = () => {
    setImageData(null);
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
          <ImageIcon sx={{ color: '#9c27b0' }} />
          <Typography variant="h6" fontWeight={600}>
            画像入力ノード設定
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
              label="画像入力"
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

          {/* Image Upload */}
          <Typography variant="subtitle2" fontWeight={600} color="text.primary">
            参照画像
          </Typography>

          <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
            この画像を他のノード（GeminiやNanobana）で参照できます。画像サイズは5MB以下にしてください。
          </Alert>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />

          {!imageData && (
            <Button
              variant="outlined"
              fullWidth
              size="large"
              startIcon={<UploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                py: 3,
                textTransform: 'none',
                borderStyle: 'dashed',
                borderWidth: 2,
              }}
            >
              画像をアップロード
            </Button>
          )}

          {imageData && (
            <Box>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: 'action.hover',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <img
                  src={`data:${imageData.mimeType};base64,${imageData.data}`}
                  alt="Upload"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '300px',
                    objectFit: 'contain',
                    borderRadius: '8px',
                  }}
                />
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<UploadIcon />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    画像を変更
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    onClick={handleRemoveImage}
                  >
                    削除
                  </Button>
                </Stack>
              </Paper>
            </Box>
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
