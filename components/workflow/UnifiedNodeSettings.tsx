'use client';

import { useState, useEffect } from 'react';
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
  Snackbar,
  Alert,
  Paper,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import TagIcon from '@mui/icons-material/Tag';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ImageIcon from '@mui/icons-material/Image';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';

import DynamicFormField from '@/components/form/DynamicFormField';
import { getNodeTypeConfig } from '@/lib/workflow/formConfigGenerator';

interface UnifiedNodeSettingsProps {
  node: Node;
  nodes?: Node[];
  edges?: Edge[];
  onClose: () => void;
  onUpdate: (nodeId: string, config: any) => void;
  onDelete: () => void;
}

export default function UnifiedNodeSettings({
  node,
  nodes,
  edges,
  onClose,
  onUpdate,
  onDelete,
}: UnifiedNodeSettingsProps) {
  const nodeType = node.data.type || node.type;
  const typeConfig = getNodeTypeConfig(nodeType);

  const [name, setName] = useState(node.data.config?.name || '');
  const [description, setDescription] = useState(node.data.config?.description || '');
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setName(node.data.config?.name || '');
    setDescription(node.data.config?.description || '');

    // フォームの初期値を設定
    const currentTypeConfig = getNodeTypeConfig(nodeType);
    const initialValues: Record<string, any> = {};
    currentTypeConfig.fields.forEach((field) => {
      // デフォルト値を設定
      let defaultValue = node.data.config?.[field.name];

      if (defaultValue === undefined) {
        // フィールドタイプに応じたデフォルト値
        switch (field.type) {
          case 'select':
            // 既存の設定からデフォルト値を取得
            if (field.name === 'model') {
              defaultValue = 'gemini-2.5-flash';
            } else if (field.name === 'voiceId') {
              defaultValue = 'JBFqnCBsd6RMkjVDRZzb';
            } else if (field.name === 'modelId') {
              defaultValue = 'eleven_turbo_v2_5';
            } else if (field.name === 'aspectRatio') {
              defaultValue = '1:1';
            } else if (field.name === 'duration') {
              defaultValue = '5';
            } else {
              defaultValue = field.options?.[0]?.value || '';
            }
            break;
          case 'slider':
            if (field.name === 'cfgScale') {
              defaultValue = 0.5;
            } else {
              defaultValue = field.min ?? 0;
            }
            break;
          case 'switch':
            defaultValue = false;
            break;
          case 'images':
          case 'characterSheets':
            defaultValue = [];
            break;
          case 'tags':
            // tagsフィールドは状態を持たないので、初期値を設定しない
            defaultValue = undefined;
            break;
          default:
            defaultValue = '';
        }
      }

      // tagsフィールドは状態を持たないので、initialValuesに追加しない
      if (field.type !== 'tags') {
        initialValues[field.name] = defaultValue;
      }
    });

    setFormValues(initialValues);
  }, [node.id, nodeType]); // nodeTypeが変わったら再初期化

  const handleFormValueChange = (fieldName: string, value: any) => {
    setFormValues((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleSave = () => {
    console.log('Saving node config:', {
      nodeId: node.id,
      nodeType,
      name,
      description,
      formValues,
    });

    // 現在の状態を保持しつつ、新しい値で更新
    const updatedConfig = {
      ...node.data.config,
      name,
      description,
      ...formValues,
    };

    onUpdate(node.id, updatedConfig);

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const getNodeIcon = () => {
    switch (nodeType) {
      case 'gemini':
        return <AutoAwesomeIcon sx={{ color: typeConfig.color }} />;
      case 'nanobana':
        return <ImageIcon sx={{ color: typeConfig.color }} />;
      case 'elevenlabs':
        return <RecordVoiceOverIcon sx={{ color: typeConfig.color }} />;
      case 'higgsfield':
      case 'seedream4':
        return <VideoLibraryIcon sx={{ color: typeConfig.color }} />;
      case 'imageInput':
        return <ImageIcon sx={{ color: typeConfig.color }} />;
      default:
        return <TagIcon color="primary" />;
    }
  };

  return (
    <Drawer
      anchor="right"
      open={true}
      onClose={onClose}
      slotProps={{
        backdrop: {
          sx: { bgcolor: 'rgba(0, 0, 0, 0.3)' },
        },
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
          {getNodeIcon()}
          <Typography variant="h6" fontWeight={600}>
            {typeConfig.displayName} ノード設定
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
                },
              }}
            />
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              ノードタイプ
            </Typography>
            <Chip
              label={typeConfig.displayName}
              sx={{
                bgcolor: typeConfig.color ? `${typeConfig.color}1A` : 'rgba(0, 0, 0, 0.1)',
                color: typeConfig.color || 'text.primary',
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

          {/* Node Type Configuration */}
          {typeConfig.fields.length > 0 && (
            <>
              <Typography variant="subtitle2" fontWeight={600} color="text.primary">
                {typeConfig.displayName} 設定
              </Typography>

              {typeConfig.fields.map((field) => (
                <DynamicFormField
                  key={field.name}
                  config={field}
                  value={formValues[field.name]}
                  onChange={(value) => handleFormValueChange(field.name, value)}
                  allValues={formValues}
                  onFieldChange={handleFormValueChange}
                />
              ))}
            </>
          )}

          {/* Response/Output Display (ノードタイプに応じて表示) */}
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

          {/* Audio Display */}
          {node.data.config?.audioData && (
            <Box>
              <Typography variant="subtitle2" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
                音声プレビュー
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: 'action.hover',
                }}
              >
                <audio
                  controls
                  style={{ width: '100%' }}
                  src={`data:${node.data.config.audioData.mimeType};base64,${node.data.config.audioData.data}`}
                />
              </Paper>
            </Box>
          )}

          {/* Video Display */}
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
            <Alert severity="error">{node.data.config.error}</Alert>
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
              bgcolor: typeConfig.color || 'primary.main',
              '&:hover': {
                bgcolor: typeConfig.color
                  ? `${typeConfig.color}CC`
                  : 'primary.dark',
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

      {/* Save Success Snackbar */}
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
