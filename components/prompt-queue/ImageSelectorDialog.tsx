'use client';

import { useState, useEffect, useCallback } from 'react';
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
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Person as PersonIcon,
  Image as ImageIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  GridOn as GridIcon,
  Landscape as LandscapeIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import ImageGridSplitDialog from './ImageGridSplitDialog';
import type { PromptQueueImageType } from '@/types/prompt-queue';

const PAGE_SIZE = 10;

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

interface SceneMaster {
  id: number;
  name: string;
  image_url: string;
  signed_url?: string;
  location?: string;
}

interface PropMaster {
  id: number;
  name: string;
  image_url: string;
  signed_url?: string;
  category?: string;
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
  maxSelections,
  currentSelections,
}: ImageSelectorDialogProps) {
  const [tabValue, setTabValue] = useState<PromptQueueImageType>('character_sheet');
  const [characterSheets, setCharacterSheets] = useState<CharacterSheet[]>([]);
  const [outputs, setOutputs] = useState<OutputImage[]>([]);
  const [scenes, setScenes] = useState<SceneMaster[]>([]);
  const [props, setProps] = useState<PropMaster[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);

  // ページング状態
  const [csPage, setCsPage] = useState(0);
  const [csTotal, setCsTotal] = useState(0);
  const [outputPage, setOutputPage] = useState(0);
  const [outputTotal, setOutputTotal] = useState(0);
  const [scenePage, setScenePage] = useState(0);
  const [sceneTotal, setSceneTotal] = useState(0);
  const [propPage, setPropPage] = useState(0);
  const [propTotal, setPropTotal] = useState(0);

  // グリッド分割ダイアログ
  const [gridSplitDialogOpen, setGridSplitDialogOpen] = useState(false);
  const [gridSplitImage, setGridSplitImage] = useState<{
    url: string;
    name: string;
    originalId: number;
  } | null>(null);
  const [savingSplitImages, setSavingSplitImages] = useState(false);

  // ダイアログが開いたときにデータをリセット
  useEffect(() => {
    if (open) {
      setSelectedImages([]);
      setCsPage(0);
      setOutputPage(0);
      setScenePage(0);
      setPropPage(0);
      setSearchQuery('');
      setTabValue('character_sheet');
    }
  }, [open]);

  // タブまたはページが変わったときにデータを取得
  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, tabValue, csPage, outputPage, scenePage, propPage]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (tabValue === 'character_sheet') {
        const offset = csPage * PAGE_SIZE;
        const response = await fetch(`/api/character-sheets?limit=${PAGE_SIZE}&offset=${offset}`);
        if (response.ok) {
          const data = await response.json();
          setCharacterSheets(data.characterSheets || []);
          setCsTotal(data.total || 0);
        }
      } else if (tabValue === 'output') {
        const offset = outputPage * PAGE_SIZE;
        const response = await fetch(`/api/outputs?type=image&limit=${PAGE_SIZE}&offset=${offset}`);
        if (response.ok) {
          const data = await response.json();
          setOutputs(data.outputs || []);
          setOutputTotal(data.total || 0);
        }
      } else if (tabValue === 'scene') {
        const response = await fetch('/api/scene-masters');
        if (response.ok) {
          const data = await response.json();
          const allScenes = data.scenes || [];
          // クライアント側でページング
          const offset = scenePage * PAGE_SIZE;
          setScenes(allScenes.slice(offset, offset + PAGE_SIZE));
          setSceneTotal(allScenes.length);
        }
      } else if (tabValue === 'prop') {
        const response = await fetch('/api/prop-masters');
        if (response.ok) {
          const data = await response.json();
          const allProps = data.props || [];
          // クライアント側でページング
          const offset = propPage * PAGE_SIZE;
          setProps(allProps.slice(offset, offset + PAGE_SIZE));
          setPropTotal(allProps.length);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [tabValue, csPage, outputPage, scenePage, propPage]);

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

  // グリッド分割ダイアログを開く
  const handleOpenGridSplit = (output: OutputImage, e: React.MouseEvent) => {
    e.stopPropagation(); // 親要素のクリックイベントを防止
    const url = getImageUrl(output.content_url);
    const name = output.metadata?.name || `Output #${output.id}`;
    setGridSplitImage({
      url,
      name,
      originalId: output.id,
    });
    setGridSplitDialogOpen(true);
  };

  // 分割画像を保存して選択に追加
  const handleSelectSplitImages = async (
    images: { dataUrl: string; name: string }[]
  ) => {
    if (images.length === 0) return;

    setSavingSplitImages(true);
    const savedImages: SelectedImage[] = [];

    try {
      for (const img of images) {
        // dataURL を Blob に変換
        const response = await fetch(img.dataUrl);
        const blob = await response.blob();

        // FormData を作成
        const formData = new FormData();
        formData.append('file', blob, `${img.name}.png`);
        formData.append('prompt', `Grid split: ${img.name}`);
        if (gridSplitImage?.originalId) {
          formData.append('originalOutputId', gridSplitImage.originalId.toString());
        }

        // API で保存
        const saveResponse = await fetch('/api/outputs/save-edited', {
          method: 'POST',
          body: formData,
        });

        if (saveResponse.ok) {
          const result = await saveResponse.json();
          if (result.success && result.output) {
            savedImages.push({
              image_type: 'output',
              reference_id: result.output.id,
              name: img.name,
              image_url: result.output.content_url,
            });
          }
        }
      }

      // 保存完了後、アウトプット一覧を再読み込み（選択はしない）
      if (savedImages.length > 0) {
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to save split images:', error);
    } finally {
      setSavingSplitImages(false);
      setGridSplitDialogOpen(false);
      setGridSplitImage(null);
    }
  };

  // 検索フィルタリング（クライアント側で現在のページ内をフィルタ）
  const filteredCharacterSheets = characterSheets.filter((cs) =>
    cs.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOutputs = outputs.filter((output) => {
    const name = output.metadata?.name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredScenes = scenes.filter((scene) =>
    scene.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (scene.location || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProps = props.filter((prop) =>
    prop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (prop.category || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const remainingSelections = maxSelections - selectedImages.length;

  // ページング計算
  const getPageInfo = () => {
    switch (tabValue) {
      case 'character_sheet':
        return { page: csPage, total: csTotal, setPage: setCsPage };
      case 'output':
        return { page: outputPage, total: outputTotal, setPage: setOutputPage };
      case 'scene':
        return { page: scenePage, total: sceneTotal, setPage: setScenePage };
      case 'prop':
        return { page: propPage, total: propTotal, setPage: setPropPage };
      default:
        return { page: 0, total: 0, setPage: () => {} };
    }
  };
  const { page: currentPage, total: totalItems, setPage } = getPageInfo();
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setPage(currentPage + 1);
    }
  };

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
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            value="character_sheet"
            label="キャラクター"
            icon={<PersonIcon />}
            iconPosition="start"
          />
          <Tab
            value="output"
            label="アウトプット"
            icon={<ImageIcon />}
            iconPosition="start"
          />
          <Tab
            value="scene"
            label="シーン画像"
            icon={<LandscapeIcon />}
            iconPosition="start"
          />
          <Tab
            value="prop"
            label="小物画像"
            icon={<CategoryIcon />}
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
          <Box sx={{ minHeight: 300 }}>
            <Grid container spacing={1}>
              {tabValue === 'character_sheet' ? (
                filteredCharacterSheets.length > 0 ? (
                  filteredCharacterSheets.map((cs) => {
                    const url = getImageUrl(cs.image_url);
                    const selected = isSelected('character_sheet', cs.id);
                    const alreadySelected = isAlreadySelected('character_sheet', cs.id);
                    const disabled = alreadySelected || (remainingSelections === 0 && !selected);

                    return (
                      <Grid size={{ xs: 4, sm: 3, md: 2.4 }} key={cs.id}>
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
              ) : tabValue === 'output' ? (
                filteredOutputs.length > 0 ? (
                  filteredOutputs.map((output) => {
                    const url = getImageUrl(output.content_url);
                    const selected = isSelected('output', output.id);
                    const alreadySelected = isAlreadySelected('output', output.id);
                    const disabled = alreadySelected || (remainingSelections === 0 && !selected);
                    const name = output.metadata?.name || `Output #${output.id}`;

                    return (
                      <Grid size={{ xs: 4, sm: 3, md: 2.4 }} key={output.id}>
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
                          {/* グリッド分割ボタン */}
                          <Tooltip title="等分切り出し">
                            <IconButton
                              size="small"
                              onClick={(e) => handleOpenGridSplit(output, e)}
                              sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                bgcolor: 'rgba(255,255,255,0.8)',
                                borderRadius: '0 0 4px 0',
                                padding: '2px',
                                '&:hover': {
                                  bgcolor: 'rgba(156, 39, 176, 0.2)',
                                },
                              }}
                            >
                              <GridIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
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
                )
              ) : tabValue === 'scene' ? (
                filteredScenes.length > 0 ? (
                  filteredScenes.map((scene) => {
                    const url = scene.signed_url || getImageUrl(scene.image_url);
                    const selected = isSelected('scene', scene.id);
                    const alreadySelected = isAlreadySelected('scene', scene.id);
                    const disabled = alreadySelected || (remainingSelections === 0 && !selected);

                    return (
                      <Grid size={{ xs: 4, sm: 3, md: 2.4 }} key={scene.id}>
                        <Box
                          onClick={() => {
                            if (!disabled) {
                              handleToggleImage({
                                image_type: 'scene',
                                reference_id: scene.id,
                                name: scene.name,
                                image_url: scene.image_url,
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
                            border: selected ? '3px solid #0288d1' : '1px solid #ddd',
                            '&:hover': disabled ? {} : { borderColor: '#0288d1' },
                          }}
                        >
                          {url ? (
                            <img
                              src={url}
                              alt={scene.name}
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
                              <LandscapeIcon sx={{ color: 'grey.400', fontSize: 40 }} />
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
                            {scene.name}
                          </Typography>
                        </Box>
                      </Grid>
                    );
                  })
                ) : (
                  <Grid size={{ xs: 12 }}>
                    <Typography color="text.secondary" textAlign="center" py={4}>
                      シーン画像がありません
                    </Typography>
                  </Grid>
                )
              ) : tabValue === 'prop' ? (
                filteredProps.length > 0 ? (
                  filteredProps.map((prop) => {
                    const url = prop.signed_url || getImageUrl(prop.image_url);
                    const selected = isSelected('prop', prop.id);
                    const alreadySelected = isAlreadySelected('prop', prop.id);
                    const disabled = alreadySelected || (remainingSelections === 0 && !selected);

                    return (
                      <Grid size={{ xs: 4, sm: 3, md: 2.4 }} key={prop.id}>
                        <Box
                          onClick={() => {
                            if (!disabled) {
                              handleToggleImage({
                                image_type: 'prop',
                                reference_id: prop.id,
                                name: prop.name,
                                image_url: prop.image_url,
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
                            border: selected ? '3px solid #ff9800' : '1px solid #ddd',
                            '&:hover': disabled ? {} : { borderColor: '#ff9800' },
                          }}
                        >
                          {url ? (
                            <img
                              src={url}
                              alt={prop.name}
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
                              <CategoryIcon sx={{ color: 'grey.400', fontSize: 40 }} />
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
                            {prop.name}
                          </Typography>
                        </Box>
                      </Grid>
                    );
                  })
                ) : (
                  <Grid size={{ xs: 12 }}>
                    <Typography color="text.secondary" textAlign="center" py={4}>
                      小物画像がありません
                    </Typography>
                  </Grid>
                )
              ) : null}
            </Grid>

            {/* ページング */}
            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 2, gap: 2 }}>
                <IconButton
                  onClick={handlePrevPage}
                  disabled={currentPage === 0}
                  size="small"
                >
                  <ChevronLeftIcon />
                </IconButton>
                <Typography variant="body2">
                  {currentPage + 1} / {totalPages} ページ（全{totalItems}件）
                </Typography>
                <IconButton
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages - 1}
                  size="small"
                >
                  <ChevronRightIcon />
                </IconButton>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={selectedImages.length === 0 || savingSplitImages}
          startIcon={savingSplitImages ? <CircularProgress size={16} /> : undefined}
        >
          {savingSplitImages ? '保存中...' : `${selectedImages.length}枚を追加`}
        </Button>
      </DialogActions>

      {/* グリッド分割ダイアログ */}
      {gridSplitImage && (
        <ImageGridSplitDialog
          open={gridSplitDialogOpen}
          onClose={() => {
            setGridSplitDialogOpen(false);
            setGridSplitImage(null);
          }}
          imageUrl={gridSplitImage.url}
          imageName={gridSplitImage.name}
          onSelectSplitImages={handleSelectSplitImages}
          maxSelections={remainingSelections}
        />
      )}
    </Dialog>
  );
}
