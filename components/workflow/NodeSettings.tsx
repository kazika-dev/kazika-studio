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
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import TagIcon from '@mui/icons-material/Tag';
import LocationOnIcon from '@mui/icons-material/LocationOn';

interface NodeSettingsProps {
  node: Node;
  onClose: () => void;
  onUpdate: (nodeId: string, config: any) => void;
  onDelete: () => void;
}

export default function NodeSettings({ node, onClose, onUpdate, onDelete }: NodeSettingsProps) {
  const [name, setName] = useState(node.data.config?.name || '');
  const [description, setDescription] = useState(node.data.config?.description || '');

  useEffect(() => {
    setName(node.data.config?.name || '');
    setDescription(node.data.config?.description || '');
  }, [node]);

  const handleSave = () => {
    onUpdate(node.id, {
      name,
      description,
    });
  };

  const getTypeColor = () => {
    switch (node.data.type) {
      case 'input':
        return 'primary';
      case 'process':
        return 'success';
      case 'output':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <Drawer
      anchor="right"
      open={true}
      onClose={onClose}
      sx={{
        zIndex: 1300,
      }}
      PaperProps={{
        sx: {
          width: 400,
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
          <TagIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>
            ノード設定
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ p: 3 }}>
        <Stack spacing={3}>
          {/* Node ID */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              ノードID
            </Typography>
            <TextField
              fullWidth
              value={node.id}
              disabled
              size="small"
              InputProps={{
                sx: { fontFamily: 'monospace', fontSize: '0.875rem' },
              }}
            />
          </Box>

          {/* Node Type */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              ノードタイプ
            </Typography>
            <Chip
              label={node.data.type}
              color={getTypeColor() as any}
              sx={{ textTransform: 'capitalize', fontWeight: 500 }}
            />
          </Box>

          <Divider />

          {/* Node Name */}
          <TextField
            label="名前"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            variant="outlined"
            size="medium"
          />

          {/* Description */}
          <TextField
            label="説明"
            fullWidth
            multiline
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            variant="outlined"
          />

          <Divider />

          {/* Position */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <LocationOnIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                位置
              </Typography>
            </Box>
            <Stack direction="row" spacing={2}>
              <TextField
                label="X"
                value={Math.round(node.position.x)}
                disabled
                size="small"
                InputProps={{
                  sx: { fontFamily: 'monospace' },
                }}
              />
              <TextField
                label="Y"
                value={Math.round(node.position.y)}
                disabled
                size="small"
                InputProps={{
                  sx: { fontFamily: 'monospace' },
                }}
              />
            </Stack>
          </Box>

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
    </Drawer>
  );
}
