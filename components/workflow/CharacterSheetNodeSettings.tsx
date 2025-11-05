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
  Alert,
  Snackbar,
  Card,
  CardContent,
  CardMedia,
  Radio,
  RadioGroup,
  FormControlLabel,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';

interface CharacterSheet {
  id: number;
  user_id: string;
  name: string;
  image_url: string;
  description: string;
  metadata: any;
  created_at: string;
  updated_at: string;
}

interface CharacterSheetNodeSettingsProps {
  node: Node;
  onClose: () => void;
  onUpdate: (nodeId: string, config: any) => void;
  onDelete: () => void;
}

export default function CharacterSheetNodeSettings({ node, onClose, onUpdate, onDelete }: CharacterSheetNodeSettingsProps) {
  const [name, setName] = useState(node.data.config?.name || '');
  const [description, setDescription] = useState(node.data.config?.description || '');
  const [selectedCharacterSheetId, setSelectedCharacterSheetId] = useState<number | null>(
    node.data.config?.characterSheet?.id || null
  );
  const [characterSheets, setCharacterSheets] = useState<CharacterSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadCharacterSheets();
  }, []);

  useEffect(() => {
    setName(node.data.config?.name || '');
    setDescription(node.data.config?.description || '');
    setSelectedCharacterSheetId(node.data.config?.characterSheet?.id || null);
  }, [node]);

  const loadCharacterSheets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/character-sheets');
      const data = await response.json();

      if (data.success) {
        setCharacterSheets(data.characterSheets);
      } else {
        console.error('Failed to load character sheets:', data.error);
      }
    } catch (error) {
      console.error('Failed to load character sheets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    const selectedSheet = characterSheets.find(cs => cs.id === selectedCharacterSheetId);

    onUpdate(node.id, {
      name,
      description,
      characterSheet: selectedSheet || null,
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const getImageUrl = (imageUrl: string) => {
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    return `/api/storage/${imageUrl}`;
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
          width: 500,
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
          <PersonIcon sx={{ color: '#ff6b9d' }} />
          <Typography variant="h6" fontWeight={600}>
            キャラクターシートノード設定
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ p: 3, overflow: 'auto', flex: 1 }}>
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
              label="キャラクターシート"
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

          {/* Character Sheet Selection */}
          <Typography variant="subtitle2" fontWeight={600} color="text.primary">
            キャラクターシートを選択
          </Typography>

          <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
            選択したキャラクターシートの画像が次のノードに送られます
          </Alert>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : characterSheets.length === 0 ? (
            <Alert severity="warning">
              キャラクターシートがありません。先にキャラクターシートを作成してください。
            </Alert>
          ) : (
            <RadioGroup
              value={selectedCharacterSheetId?.toString() || ''}
              onChange={(e) => setSelectedCharacterSheetId(parseInt(e.target.value))}
            >
              <Stack spacing={2}>
                {characterSheets.map((sheet) => (
                  <Card
                    key={sheet.id}
                    variant="outlined"
                    sx={{
                      cursor: 'pointer',
                      border: selectedCharacterSheetId === sheet.id ? 2 : 1,
                      borderColor: selectedCharacterSheetId === sheet.id ? 'primary.main' : 'divider',
                      '&:hover': {
                        boxShadow: 2,
                      },
                    }}
                    onClick={() => setSelectedCharacterSheetId(sheet.id)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
                      <FormControlLabel
                        value={sheet.id.toString()}
                        control={<Radio />}
                        label=""
                        sx={{ m: 0, mr: 1 }}
                      />
                      <CardMedia
                        component="img"
                        image={getImageUrl(sheet.image_url)}
                        alt={sheet.name}
                        sx={{
                          width: 80,
                          height: 80,
                          objectFit: 'cover',
                          borderRadius: 1,
                        }}
                      />
                      <CardContent sx={{ flex: 1, py: 1, '&:last-child': { pb: 1 } }}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {sheet.name}
                        </Typography>
                        {sheet.description && (
                          <Typography variant="caption" color="text.secondary">
                            {sheet.description}
                          </Typography>
                        )}
                      </CardContent>
                    </Box>
                  </Card>
                ))}
              </Stack>
            </RadioGroup>
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
