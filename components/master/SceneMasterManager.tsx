'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ArrowBack as ArrowBackIcon,
  CloudUpload as CloudUploadIcon,
  Landscape as LandscapeIcon,
  Brush as BrushIcon,
} from '@mui/icons-material';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import { Scene } from '@/lib/db';
import ImageEditor from '@/components/common/ImageEditor';

// シーン設定オプション
const LOCATION_OPTIONS = [
  { value: 'school', label: '学校' },
  { value: 'home', label: '自宅' },
  { value: 'outdoor', label: '屋外' },
  { value: 'office', label: 'オフィス' },
  { value: 'cafe', label: 'カフェ' },
  { value: 'park', label: '公園' },
  { value: 'station', label: '駅' },
  { value: 'shop', label: '店舗' },
  { value: 'other', label: 'その他' },
];

const TIME_OF_DAY_OPTIONS = [
  { value: 'morning', label: '朝' },
  { value: 'afternoon', label: '昼' },
  { value: 'evening', label: '夕方' },
  { value: 'night', label: '夜' },
];

const WEATHER_OPTIONS = [
  { value: 'sunny', label: '晴れ' },
  { value: 'cloudy', label: '曇り' },
  { value: 'rainy', label: '雨' },
  { value: 'snowy', label: '雪' },
];

const MOOD_OPTIONS = [
  { value: 'peaceful', label: '穏やか' },
  { value: 'tense', label: '緊迫' },
  { value: 'romantic', label: 'ロマンチック' },
  { value: 'mysterious', label: '神秘的' },
  { value: 'cheerful', label: '明るい' },
  { value: 'melancholic', label: '憂鬱' },
];

interface SceneWithUrl extends Scene {
  signed_url?: string;
}

export default function SceneMasterManager() {
  const router = useRouter();
  const [scenes, setScenes] = useState<SceneWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedScene, setSelectedScene] = useState<SceneWithUrl | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // フォーム状態
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formTimeOfDay, setFormTimeOfDay] = useState('');
  const [formWeather, setFormWeather] = useState('');
  const [formMood, setFormMood] = useState('');
  const [formPromptHintJa, setFormPromptHintJa] = useState('');
  const [formPromptHintEn, setFormPromptHintEn] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formFile, setFormFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    loadScenes();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const loadScenes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/scene-masters');
      const data = await response.json();

      if (data.success) {
        setScenes(data.scenes);
      } else {
        toast.error('データの取得に失敗しました');
      }
    } catch (error) {
      console.error('Failed to load scenes:', error);
      toast.error('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedScene) return;

    try {
      const response = await fetch(`/api/scene-masters/${selectedScene.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('削除しました');
        loadScenes();
      } else {
        toast.error('削除に失敗しました');
      }
    } catch (error) {
      console.error('Failed to delete scene:', error);
      toast.error('削除に失敗しました');
    } finally {
      setDeleteDialogOpen(false);
      setSelectedScene(null);
    }
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('名前を入力してください');
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append('name', formName.trim());
      formData.append('description', formDescription.trim());
      formData.append('location', formLocation);
      formData.append('time_of_day', formTimeOfDay);
      formData.append('weather', formWeather);
      formData.append('mood', formMood);
      formData.append('prompt_hint_ja', formPromptHintJa.trim());
      formData.append('prompt_hint_en', formPromptHintEn.trim());
      formData.append('tags', JSON.stringify(formTags));
      if (formFile) {
        formData.append('image', formFile);
      }

      const response = await fetch('/api/scene-masters', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        toast.success('作成しました');
        setCreateDialogOpen(false);
        resetForm();
        loadScenes();
      } else {
        toast.error(data.error || '作成に失敗しました');
      }
    } catch (error) {
      console.error('Failed to create scene:', error);
      toast.error('作成に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedScene || !formName.trim()) {
      toast.error('名前を入力してください');
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append('name', formName.trim());
      formData.append('description', formDescription.trim());
      formData.append('location', formLocation);
      formData.append('time_of_day', formTimeOfDay);
      formData.append('weather', formWeather);
      formData.append('mood', formMood);
      formData.append('prompt_hint_ja', formPromptHintJa.trim());
      formData.append('prompt_hint_en', formPromptHintEn.trim());
      formData.append('tags', JSON.stringify(formTags));
      if (formFile) {
        formData.append('image', formFile);
      }

      const response = await fetch(`/api/scene-masters/${selectedScene.id}`, {
        method: 'PUT',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        toast.success('更新しました');
        setEditDialogOpen(false);
        resetForm();
        loadScenes();
      } else {
        toast.error(data.error || '更新に失敗しました');
      }
    } catch (error) {
      console.error('Failed to update scene:', error);
      toast.error('更新に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormLocation('');
    setFormTimeOfDay('');
    setFormWeather('');
    setFormMood('');
    setFormPromptHintJa('');
    setFormPromptHintEn('');
    setFormTags([]);
    setFormFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast.error('PNG, JPG, JPEG, WEBP形式のファイルのみアップロード可能です');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error('ファイルサイズは10MB以下にしてください');
        return;
      }

      setFormFile(file);

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const openCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
  };

  const openEditDialog = (scene: SceneWithUrl) => {
    setSelectedScene(scene);
    setFormName(scene.name);
    setFormDescription(scene.description || '');
    setFormLocation(scene.location || '');
    setFormTimeOfDay(scene.time_of_day || '');
    setFormWeather(scene.weather || '');
    setFormMood(scene.mood || '');
    setFormPromptHintJa(scene.prompt_hint_ja || '');
    setFormPromptHintEn(scene.prompt_hint_en || '');
    setFormTags(scene.tags || []);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (scene: SceneWithUrl) => {
    setSelectedScene(scene);
    setDeleteDialogOpen(true);
  };

  const openImageEditor = (scene: SceneWithUrl) => {
    if (scene.image_url) {
      // GCP署名付きURLではなく、/api/storage経由のURLを使用
      const proxyUrl = `/api/storage/${scene.image_url}`;
      setEditingImageUrl(proxyUrl);
      setSelectedScene(scene);
      setImageEditorOpen(true);
    }
  };

  const handleSaveEditedImage = async (blob: Blob, saveMode?: 'overwrite' | 'new') => {
    if (!selectedScene) {
      toast.error('シーンが選択されていません');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('image', blob);

      let response;
      let successMessage;

      if (saveMode === 'new') {
        // 新規保存: 元のシーン情報をコピーして新規作成
        formData.append('name', `${selectedScene.name} (編集済み)`);
        formData.append('description', selectedScene.description || '');
        formData.append('location', selectedScene.location || '');
        formData.append('time_of_day', selectedScene.time_of_day || '');
        formData.append('weather', selectedScene.weather || '');
        formData.append('mood', selectedScene.mood || '');
        formData.append('prompt_hint_ja', selectedScene.prompt_hint_ja || '');
        formData.append('prompt_hint_en', selectedScene.prompt_hint_en || '');
        formData.append('tags', JSON.stringify(selectedScene.tags || []));

        response = await fetch('/api/scene-masters', {
          method: 'POST',
          body: formData,
        });
        successMessage = '新しいシーンとして保存しました';
      } else {
        // 上書き保存（デフォルト）
        response = await fetch(`/api/scene-masters/${selectedScene.id}/replace-image`, {
          method: 'PUT',
          body: formData,
        });
        successMessage = '画像を更新しました';
      }

      const data = await response.json();

      if (data.success) {
        toast.success(successMessage);
        setImageEditorOpen(false);
        setEditingImageUrl(null);
        loadScenes();
      } else {
        toast.error(data.error || '画像の保存に失敗しました');
      }
    } catch (error) {
      console.error('Failed to save edited image:', error);
      toast.error('画像の保存に失敗しました');
    }
  };

  const getLabelForOption = (options: { value: string; label: string }[], value: string | null) => {
    if (!value) return '-';
    const option = options.find(o => o.value === value);
    return option ? option.label : value;
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Toaster position="top-center" richColors />

      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => router.push('/master')}
        sx={{ mb: 2 }}
      >
        マスタ管理に戻る
      </Button>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            シーンマスタ
          </Typography>
          <Typography variant="body2" color="text.secondary">
            背景画像と場所情報を管理します
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreateDialog}
        >
          新規作成
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>サムネイル</TableCell>
                <TableCell>名前</TableCell>
                <TableCell>場所</TableCell>
                <TableCell>時間帯</TableCell>
                <TableCell>天気</TableCell>
                <TableCell>雰囲気</TableCell>
                <TableCell>タグ</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {scenes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      シーンがありません
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                scenes.map((scene) => (
                  <TableRow key={scene.id} hover>
                    <TableCell>
                      {scene.signed_url ? (
                        <Box
                          component="img"
                          src={scene.signed_url}
                          alt={scene.name}
                          sx={{
                            width: 100,
                            height: 60,
                            objectFit: 'cover',
                            borderRadius: 1,
                            bgcolor: 'grey.100',
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: 100,
                            height: 60,
                            bgcolor: 'grey.200',
                            borderRadius: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <LandscapeIcon color="disabled" />
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {scene.name}
                      </Typography>
                      {scene.description && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {scene.description.substring(0, 50)}{scene.description.length > 50 ? '...' : ''}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{getLabelForOption(LOCATION_OPTIONS, scene.location)}</TableCell>
                    <TableCell>{getLabelForOption(TIME_OF_DAY_OPTIONS, scene.time_of_day)}</TableCell>
                    <TableCell>{getLabelForOption(WEATHER_OPTIONS, scene.weather)}</TableCell>
                    <TableCell>{getLabelForOption(MOOD_OPTIONS, scene.mood)}</TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        {scene.tags?.slice(0, 3).map((tag, index) => (
                          <Chip key={index} label={tag} size="small" variant="outlined" />
                        ))}
                        {scene.tags && scene.tags.length > 3 && (
                          <Chip
                            label={`+${scene.tags.length - 3}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      {scene.image_url && (
                        <IconButton
                          size="small"
                          onClick={() => openImageEditor(scene)}
                          color="secondary"
                          title="画像を編集"
                        >
                          <BrushIcon />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => openEditDialog(scene)}
                        color="primary"
                        title="編集"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => openDeleteDialog(scene)}
                        color="error"
                        title="削除"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 作成ダイアログ */}
      <Dialog
        open={createDialogOpen}
        onClose={() => !submitting && setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>シーンを追加</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {/* ファイルアップロード */}
            <Box>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                fullWidth
              >
                背景画像をアップロード（オプション）
              </Button>
              {previewUrl && (
                <Box mt={2} textAlign="center">
                  <Box
                    component="img"
                    src={previewUrl}
                    alt="Preview"
                    sx={{
                      maxWidth: '100%',
                      maxHeight: 200,
                      objectFit: 'contain',
                      borderRadius: 1,
                    }}
                  />
                </Box>
              )}
            </Box>

            <TextField
              label="シーン名"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              fullWidth
              required
            />

            <TextField
              label="説明"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />

            <Box display="flex" gap={2}>
              <FormControl fullWidth>
                <InputLabel>場所</InputLabel>
                <Select
                  value={formLocation}
                  label="場所"
                  onChange={(e) => setFormLocation(e.target.value)}
                >
                  <MenuItem value="">選択しない</MenuItem>
                  {LOCATION_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>時間帯</InputLabel>
                <Select
                  value={formTimeOfDay}
                  label="時間帯"
                  onChange={(e) => setFormTimeOfDay(e.target.value)}
                >
                  <MenuItem value="">選択しない</MenuItem>
                  {TIME_OF_DAY_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box display="flex" gap={2}>
              <FormControl fullWidth>
                <InputLabel>天気</InputLabel>
                <Select
                  value={formWeather}
                  label="天気"
                  onChange={(e) => setFormWeather(e.target.value)}
                >
                  <MenuItem value="">選択しない</MenuItem>
                  {WEATHER_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>雰囲気</InputLabel>
                <Select
                  value={formMood}
                  label="雰囲気"
                  onChange={(e) => setFormMood(e.target.value)}
                >
                  <MenuItem value="">選択しない</MenuItem>
                  {MOOD_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <TextField
              label="プロンプトヒント（日本語）"
              value={formPromptHintJa}
              onChange={(e) => setFormPromptHintJa(e.target.value)}
              fullWidth
              multiline
              rows={2}
              helperText="画像生成時に使用するプロンプトのヒント"
            />

            <TextField
              label="プロンプトヒント（英語）"
              value={formPromptHintEn}
              onChange={(e) => setFormPromptHintEn(e.target.value)}
              fullWidth
              multiline
              rows={2}
              helperText="Image generation prompt hint in English"
            />

            <Autocomplete
              multiple
              freeSolo
              options={[]}
              value={formTags}
              onChange={(_, newValue) => setFormTags(newValue)}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="outlined"
                    label={option}
                    size="small"
                    {...getTagProps({ index })}
                    key={option}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="タグ"
                  placeholder="Enterで追加"
                  helperText="検索用のタグを追加"
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={submitting}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={submitting || !formName.trim()}
          >
            {submitting ? <CircularProgress size={24} /> : '作成'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 編集ダイアログ */}
      <Dialog
        open={editDialogOpen}
        onClose={() => !submitting && setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>シーンを編集</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {/* 現在の画像 */}
            {selectedScene?.signed_url && (
              <Box textAlign="center">
                <Box
                  component="img"
                  src={selectedScene.signed_url}
                  alt={selectedScene.name}
                  sx={{
                    maxWidth: '100%',
                    maxHeight: 150,
                    objectFit: 'contain',
                    borderRadius: 1,
                  }}
                />
                <Box mt={2}>
                  <Button
                    variant="outlined"
                    startIcon={<BrushIcon />}
                    onClick={() => {
                      setEditDialogOpen(false);
                      openImageEditor(selectedScene);
                    }}
                    size="small"
                  >
                    画像を編集
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  画像エディタで編集できます（描画、テキスト追加、選択範囲の移動・削除など）
                </Typography>
              </Box>
            )}

            {/* 新しい画像アップロード */}
            <Box>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                fullWidth
              >
                新しい画像をアップロード
              </Button>
              {previewUrl && (
                <Box mt={2} textAlign="center">
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    新しい画像:
                  </Typography>
                  <Box
                    component="img"
                    src={previewUrl}
                    alt="Preview"
                    sx={{
                      maxWidth: '100%',
                      maxHeight: 150,
                      objectFit: 'contain',
                      borderRadius: 1,
                    }}
                  />
                </Box>
              )}
            </Box>

            <TextField
              label="シーン名"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              fullWidth
              required
            />

            <TextField
              label="説明"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />

            <Box display="flex" gap={2}>
              <FormControl fullWidth>
                <InputLabel>場所</InputLabel>
                <Select
                  value={formLocation}
                  label="場所"
                  onChange={(e) => setFormLocation(e.target.value)}
                >
                  <MenuItem value="">選択しない</MenuItem>
                  {LOCATION_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>時間帯</InputLabel>
                <Select
                  value={formTimeOfDay}
                  label="時間帯"
                  onChange={(e) => setFormTimeOfDay(e.target.value)}
                >
                  <MenuItem value="">選択しない</MenuItem>
                  {TIME_OF_DAY_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box display="flex" gap={2}>
              <FormControl fullWidth>
                <InputLabel>天気</InputLabel>
                <Select
                  value={formWeather}
                  label="天気"
                  onChange={(e) => setFormWeather(e.target.value)}
                >
                  <MenuItem value="">選択しない</MenuItem>
                  {WEATHER_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>雰囲気</InputLabel>
                <Select
                  value={formMood}
                  label="雰囲気"
                  onChange={(e) => setFormMood(e.target.value)}
                >
                  <MenuItem value="">選択しない</MenuItem>
                  {MOOD_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <TextField
              label="プロンプトヒント（日本語）"
              value={formPromptHintJa}
              onChange={(e) => setFormPromptHintJa(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />

            <TextField
              label="プロンプトヒント（英語）"
              value={formPromptHintEn}
              onChange={(e) => setFormPromptHintEn(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />

            <Autocomplete
              multiple
              freeSolo
              options={[]}
              value={formTags}
              onChange={(_, newValue) => setFormTags(newValue)}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="outlined"
                    label={option}
                    size="small"
                    {...getTagProps({ index })}
                    key={option}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="タグ"
                  placeholder="Enterで追加"
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} disabled={submitting}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdate}
            disabled={submitting || !formName.trim()}
          >
            {submitting ? <CircularProgress size={24} /> : '更新'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>シーンを削除</DialogTitle>
        <DialogContent>
          <Typography>
            「{selectedScene?.name}」を削除しますか？この操作は取り消せません。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
          >
            削除
          </Button>
        </DialogActions>
      </Dialog>

      {/* 画像エディタ */}
      {imageEditorOpen && editingImageUrl && (
        <ImageEditor
          imageUrl={editingImageUrl}
          onSave={handleSaveEditedImage}
          onClose={() => {
            setImageEditorOpen(false);
            setEditingImageUrl(null);
          }}
          enableSaveModeSelection={true}
        />
      )}
    </Container>
  );
}
