'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Tabs,
  Tab,
  Grid,
  Checkbox,
  CircularProgress,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  Person as PersonIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import type { PromptQueueImageType } from '@/types/prompt-queue';

interface SelectedImage {
  image_type: PromptQueueImageType;
  reference_id: number;
  name?: string;
  image_url?: string;
}

interface ImageSelectorDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (images: SelectedImage[]) => void;
  type: 'character_sheet' | 'output';
  maxSelections: number;
  currentSelections: SelectedImage[];
}

interface CharacterSheet {
  id: number;
  name: string;
  image_url: string;
}

interface OutputImage {
  id: number;
  content_url: string;
  output_type: string;
  metadata?: Record<string, any>;
  created_at: string;
}

/**
 * 画像URLを取得（GCP Storageパスの場合はAPIエンドポイント経由）
 */
function getImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `/api/storage/${url}`;
}

export default function ImageSelectorDialog({
  open,
  onClose,
  onSelect,
  type,
  maxSelections,
  currentSelections,
}: ImageSelectorDialogProps) {
  const [tabValue, setTabValue] = useState<'character_sheet' | 'output'>(type);
  const [characterSheets, setCharacterSheets] = useState<CharacterSheet[]>([]);
  const [outputs, setOutputs] = useState<OutputImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);

  // タブ変更時にタイプを更新
  useEffect(() => {
    setTabValue(type);
  }, [type]);

  // ダイアログが開いたときにデータを取得
  useEffect(() => {
    if (open) {
      setSelectedImages([]);
      fetchData();
    }
  }, [open, tabValue]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tabValue === 'character_sheet') {
        const response = await fetch('/api/character-sheets');
        if (response.ok) {
          const data = await response.json();
          setCharacterSheets(data.characterSheets || []);
        }
      } else {
        const response = await fetch('/api/outputs?type=image&limit=50');
        if (response.ok) {
          const data = await response.json();
          setOutputs(data.outputs || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleImage = (image: SelectedImage) => {
    setSelectedImages((prev) => {
      const exists = prev.some(
        (img) => img.image_type === image.image_type && img.reference_id === image.reference_id
      );
      if (exists) {
        return prev.filter(
          (img) => !(img.image_type === image.image_type && img.reference_id === image.reference_id)
        );
      }
      if (prev.length >= maxSelections) {
        return prev;
      }
      return [...prev, image];
    });
  };

  const isSelected = (imageType: PromptQueueImageType, referenceId: number) => {
    return (
      selectedImages.some(
        (img) => img.image_type === imageType && img.reference_id === referenceId
      ) ||
      currentSelections.some(
        (img) => img.image_type === imageType && img.reference_id === referenceId
      )
    );
  };

  const isAlreadySelected = (imageType: PromptQueueImageType, referenceId: number) => {
    return currentSelections.some(
      (img) => img.image_type === imageType && img.reference_id === referenceId
    );
  };

  const handleConfirm = () => {
    onSelect(selectedImages);
  };

  const filteredCharacterSheets = characterSheets.filter((cs) =>
    cs.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOutputs = outputs.filter((output) => {
    const name = output.metadata?.name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const remainingSelections = maxSelections - selectedImages.length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">参照画像を選択</Typography>
          <Typography variant="body2" color="text.secondary">
            {selectedImages.length}/{maxSelections}枚選択中
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Tabs
          value={tabValue}
          onChange={(_, value) => setTabValue(value)}
          sx={{ mb: 2 }}
        >
          <Tab
            value="character_sheet"
            label="キャラクターシート"
            icon={<PersonIcon />}
            iconPosition="start"
          />
          <Tab
            value="output"
            label="アウトプット画像"
            icon={<ImageIcon />}
            iconPosition="start"
          />
        </Tabs>

        <TextField
          fullWidth
          size="small"
          placeholder="検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            <Grid container spacing={1}>
              {tabValue === 'character_sheet' ? (
                filteredCharacterSheets.length > 0 ? (
                  filteredCharacterSheets.map((cs) => {
                    const url = getImageUrl(cs.image_url);
                    const selected = isSelected('character_sheet', cs.id);
                    const alreadySelected = isAlreadySelected('character_sheet', cs.id);
                    const disabled = alreadySelected || (remainingSelections === 0 && !selected);

                    return (
                      <Grid size={{ xs: 4, sm: 3, md: 2 }} key={cs.id}>
                        <Box
                          onClick={() => {
                            if (!disabled) {
                              handleToggleImage({
                                image_type: 'character_sheet',
                                reference_id: cs.id,
                                name: cs.name,
                                image_url: cs.image_url,
                              });
                            }
                          }}
                          sx={{
                            position: 'relative',
                            aspectRatio: '1',
                            borderRadius: 1,
                            overflow: 'hidden',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            opacity: disabled ? 0.5 : 1,
                            border: selected ? '3px solid #1976d2' : '1px solid #ddd',
                            '&:hover': disabled ? {} : { borderColor: '#1976d2' },
                          }}
                        >
                          {url ? (
                            <img
                              src={url}
                              alt={cs.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <Box
                              sx={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: 'grey.200',
                              }}
                            >
                              <PersonIcon sx={{ color: 'grey.400', fontSize: 40 }} />
                            </Box>
                          )}
                          <Checkbox
                            checked={selected}
                            disabled={disabled}
                            sx={{
                              position: 'absolute',
                              top: 0,
                              right: 0,
                              bgcolor: 'rgba(255,255,255,0.8)',
                              borderRadius: '0 0 0 4px',
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              bgcolor: 'rgba(0,0,0,0.6)',
                              color: 'white',
                              textAlign: 'center',
                              py: 0.5,
                              px: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {cs.name}
                          </Typography>
                        </Box>
                      </Grid>
                    );
                  })
                ) : (
                  <Grid size={{ xs: 12 }}>
                    <Typography color="text.secondary" textAlign="center" py={4}>
                      キャラクターシートがありません
                    </Typography>
                  </Grid>
                )
              ) : filteredOutputs.length > 0 ? (
                filteredOutputs.map((output) => {
                  const url = getImageUrl(output.content_url);
                  const selected = isSelected('output', output.id);
                  const alreadySelected = isAlreadySelected('output', output.id);
                  const disabled = alreadySelected || (remainingSelections === 0 && !selected);
                  const name = output.metadata?.name || `Output #${output.id}`;

                  return (
                    <Grid size={{ xs: 4, sm: 3, md: 2 }} key={output.id}>
                      <Box
                        onClick={() => {
                          if (!disabled) {
                            handleToggleImage({
                              image_type: 'output',
                              reference_id: output.id,
                              name,
                              image_url: output.content_url,
                            });
                          }
                        }}
                        sx={{
                          position: 'relative',
                          aspectRatio: '1',
                          borderRadius: 1,
                          overflow: 'hidden',
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          opacity: disabled ? 0.5 : 1,
                          border: selected ? '3px solid #9c27b0' : '1px solid #ddd',
                          '&:hover': disabled ? {} : { borderColor: '#9c27b0' },
                        }}
                      >
                        {url ? (
                          <img
                            src={url}
                            alt={name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: 'grey.200',
                            }}
                          >
                            <ImageIcon sx={{ color: 'grey.400', fontSize: 40 }} />
                          </Box>
                        )}
                        <Checkbox
                          checked={selected}
                          disabled={disabled}
                          sx={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            bgcolor: 'rgba(255,255,255,0.8)',
                            borderRadius: '0 0 0 4px',
                          }}
                        />
                        <Typography
                          variant="caption"
                          sx={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            bgcolor: 'rgba(0,0,0,0.6)',
                            color: 'white',
                            textAlign: 'center',
                            py: 0.5,
                            px: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {name}
                        </Typography>
                      </Box>
                    </Grid>
                  );
                })
              ) : (
                <Grid size={{ xs: 12 }}>
                  <Typography color="text.secondary" textAlign="center" py={4}>
                    アウトプット画像がありません
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={selectedImages.length === 0}
        >
          {selectedImages.length}枚を追加
        </Button>
      </DialogActions>
    </Dialog>
  );
}
