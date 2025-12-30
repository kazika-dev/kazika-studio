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
  Category as CategoryIcon,
  Brush as BrushIcon,
} from '@mui/icons-material';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import { Prop } from '@/lib/db';
import ImageEditor from '@/components/common/ImageEditor';

// 小物カテゴリオプション
const CATEGORY_OPTIONS = [
  { value: 'accessory', label: 'アクセサリー' },
  { value: 'furniture', label: '家具' },
  { value: 'food', label: '食べ物' },
  { value: 'vehicle', label: '乗り物' },
  { value: 'weapon', label: '武器' },
  { value: 'tool', label: '道具' },
  { value: 'clothing', label: '衣服' },
  { value: 'electronics', label: '電子機器' },
  { value: 'nature', label: '自然物' },
  { value: 'other', label: 'その他' },
];

interface PropWithUrl extends Prop {
  signed_url?: string;
}

export default function PropMasterManager() {
  const router = useRouter();
  const [props, setProps] = useState<PropWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedProp, setSelectedProp] = useState<PropWithUrl | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // フォーム状態
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formPromptHintJa, setFormPromptHintJa] = useState('');
  const [formPromptHintEn, setFormPromptHintEn] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formFile, setFormFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    loadProps();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const loadProps = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/prop-masters');
      const data = await response.json();

      if (data.success) {
        setProps(data.props);
      } else {
        toast.error('データの取得に失敗しました');
      }
    } catch (error) {
      console.error('Failed to load props:', error);
      toast.error('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProp) return;

    try {
      const response = await fetch(`/api/prop-masters/${selectedProp.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('削除しました');
        loadProps();
      } else {
        toast.error('削除に失敗しました');
      }
    } catch (error) {
      console.error('Failed to delete prop:', error);
      toast.error('削除に失敗しました');
    } finally {
      setDeleteDialogOpen(false);
      setSelectedProp(null);
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
      formData.append('category', formCategory);
      formData.append('prompt_hint_ja', formPromptHintJa.trim());
      formData.append('prompt_hint_en', formPromptHintEn.trim());
      formData.append('tags', JSON.stringify(formTags));
      if (formFile) {
        formData.append('image', formFile);
      }

      const response = await fetch('/api/prop-masters', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        toast.success('作成しました');
        setCreateDialogOpen(false);
        resetForm();
        loadProps();
      } else {
        toast.error(data.error || '作成に失敗しました');
      }
    } catch (error) {
      console.error('Failed to create prop:', error);
      toast.error('作成に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedProp || !formName.trim()) {
      toast.error('名前を入力してください');
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append('name', formName.trim());
      formData.append('description', formDescription.trim());
      formData.append('category', formCategory);
      formData.append('prompt_hint_ja', formPromptHintJa.trim());
      formData.append('prompt_hint_en', formPromptHintEn.trim());
      formData.append('tags', JSON.stringify(formTags));
      if (formFile) {
        formData.append('image', formFile);
      }

      const response = await fetch(`/api/prop-masters/${selectedProp.id}`, {
        method: 'PUT',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        toast.success('更新しました');
        setEditDialogOpen(false);
        resetForm();
        loadProps();
      } else {
        toast.error(data.error || '更新に失敗しました');
      }
    } catch (error) {
      console.error('Failed to update prop:', error);
      toast.error('更新に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormCategory('');
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

  const openEditDialog = (prop: PropWithUrl) => {
    setSelectedProp(prop);
    setFormName(prop.name);
    setFormDescription(prop.description || '');
    setFormCategory(prop.category || '');
    setFormPromptHintJa(prop.prompt_hint_ja || '');
    setFormPromptHintEn(prop.prompt_hint_en || '');
    setFormTags(prop.tags || []);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (prop: PropWithUrl) => {
    setSelectedProp(prop);
    setDeleteDialogOpen(true);
  };

  const openImageEditor = (prop: PropWithUrl) => {
    if (prop.image_url) {
      // GCP署名付きURLではなく、/api/storage経由のURLを使用
      const proxyUrl = `/api/storage/${prop.image_url}`;
      setEditingImageUrl(proxyUrl);
      setSelectedProp(prop);
      setImageEditorOpen(true);
    }
  };

  const handleSaveEditedImage = async (blob: Blob, saveMode?: 'overwrite' | 'new') => {
    if (!selectedProp) {
      toast.error('小物が選択されていません');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('image', blob);

      let response;
      let successMessage;

      if (saveMode === 'new') {
        // 新規保存: 元の小物情報をコピーして新規作成
        formData.append('name', `${selectedProp.name} (編集済み)`);
        formData.append('description', selectedProp.description || '');
        formData.append('category', selectedProp.category || '');
        formData.append('prompt_hint_ja', selectedProp.prompt_hint_ja || '');
        formData.append('prompt_hint_en', selectedProp.prompt_hint_en || '');
        formData.append('tags', JSON.stringify(selectedProp.tags || []));

        response = await fetch('/api/prop-masters', {
          method: 'POST',
          body: formData,
        });
        successMessage = '新しい小物として保存しました';
      } else {
        // 上書き保存（デフォルト）
        response = await fetch(`/api/prop-masters/${selectedProp.id}/replace-image`, {
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
        loadProps();
      } else {
        toast.error(data.error || '画像の保存に失敗しました');
      }
    } catch (error) {
      console.error('Failed to save edited image:', error);
      toast.error('画像の保存に失敗しました');
    }
  };

  const getLabelForCategory = (value: string | null) => {
    if (!value) return '-';
    const option = CATEGORY_OPTIONS.find(o => o.value === value);
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
            小物マスタ
          </Typography>
          <Typography variant="body2" color="text.secondary">
            小道具・アイテムの画像と情報を管理します
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
                <TableCell>カテゴリ</TableCell>
                <TableCell>説明</TableCell>
                <TableCell>タグ</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {props.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      小物がありません
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                props.map((prop) => (
                  <TableRow key={prop.id} hover>
                    <TableCell>
                      {prop.signed_url ? (
                        <Box
                          component="img"
                          src={prop.signed_url}
                          alt={prop.name}
                          sx={{
                            width: 80,
                            height: 80,
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
                            width: 80,
                            height: 80,
                            bgcolor: 'grey.200',
                            borderRadius: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <CategoryIcon color="disabled" />
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {prop.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={getLabelForCategory(prop.category)} size="small" />
                    </TableCell>
                    <TableCell>
                      {prop.description && (
                        <Typography variant="caption" color="text.secondary">
                          {prop.description.substring(0, 50)}{prop.description.length > 50 ? '...' : ''}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        {prop.tags?.slice(0, 3).map((tag, index) => (
                          <Chip key={index} label={tag} size="small" variant="outlined" />
                        ))}
                        {prop.tags && prop.tags.length > 3 && (
                          <Chip
                            label={`+${prop.tags.length - 3}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      {prop.image_url && (
                        <IconButton
                          size="small"
                          onClick={() => openImageEditor(prop)}
                          color="secondary"
                          title="画像を編集"
                        >
                          <BrushIcon />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => openEditDialog(prop)}
                        color="primary"
                        title="編集"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => openDeleteDialog(prop)}
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
        <DialogTitle>小物を追加</DialogTitle>
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
                画像をアップロード（オプション）
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
              label="小物名"
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

            <FormControl fullWidth>
              <InputLabel>カテゴリ</InputLabel>
              <Select
                value={formCategory}
                label="カテゴリ"
                onChange={(e) => setFormCategory(e.target.value)}
              >
                <MenuItem value="">選択しない</MenuItem>
                {CATEGORY_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

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
        <DialogTitle>小物を編集</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {/* 現在の画像 */}
            {selectedProp?.signed_url && (
              <Box textAlign="center">
                <Box
                  component="img"
                  src={selectedProp.signed_url}
                  alt={selectedProp.name}
                  sx={{
                    maxWidth: '100%',
                    maxHeight: 150,
                    objectFit: 'contain',
                    borderRadius: 1,
                  }}
                />
                {selectedProp?.image_url && (
                  <Button
                    variant="outlined"
                    startIcon={<BrushIcon />}
                    onClick={() => {
                      setEditDialogOpen(false);
                      openImageEditor(selectedProp);
                    }}
                    sx={{ mt: 1 }}
                    size="small"
                  >
                    画像を編集
                  </Button>
                )}
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
              label="小物名"
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

            <FormControl fullWidth>
              <InputLabel>カテゴリ</InputLabel>
              <Select
                value={formCategory}
                label="カテゴリ"
                onChange={(e) => setFormCategory(e.target.value)}
              >
                <MenuItem value="">選択しない</MenuItem>
                {CATEGORY_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

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
        <DialogTitle>小物を削除</DialogTitle>
        <DialogContent>
          <Typography>
            「{selectedProp?.name}」を削除しますか？この操作は取り消せません。
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
