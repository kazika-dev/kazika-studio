'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Card,
  CardContent,
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
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  CardMedia,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ArrowBack as ArrowBackIcon,
  CloudUpload as CloudUploadIcon,
  Image as ImageIcon,
  Brush as BrushIcon,
} from '@mui/icons-material';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import { ImageMaterial, IMAGE_MATERIAL_CATEGORIES } from '@/types/image-material';
import ImageEditor from '@/components/common/ImageEditor';

export default function ImageMaterialsManager() {
  const router = useRouter();
  const [materials, setMaterials] = useState<ImageMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<ImageMaterial | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<ImageMaterial | null>(null); // イメージエディタ専用の状態
  const fileInputRef = useRef<HTMLInputElement>(null);

  // フォーム状態
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('背景');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formFile, setFormFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    loadMaterials();
  }, []);

  useEffect(() => {
    // プレビュー用のオブジェクトURLをクリーンアップ
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/image-materials');
      const data = await response.json();

      if (data.success) {
        setMaterials(data.materials);
      } else {
        toast.error('データの取得に失敗しました');
      }
    } catch (error) {
      console.error('Failed to load image materials:', error);
      toast.error('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMaterial) return;

    try {
      const response = await fetch(`/api/image-materials/${selectedMaterial.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('削除しました');
        loadMaterials();
      } else {
        toast.error('削除に失敗しました');
      }
    } catch (error) {
      console.error('Failed to delete image material:', error);
      toast.error('削除に失敗しました');
    } finally {
      setDeleteDialogOpen(false);
      setSelectedMaterial(null);
    }
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('名前を入力してください');
      return;
    }

    if (!formFile) {
      toast.error('画像ファイルを選択してください');
      return;
    }

    try {
      setSubmitting(true);
      setUploading(true);

      const formData = new FormData();
      formData.append('name', formName.trim());
      formData.append('description', formDescription.trim());
      formData.append('category', formCategory);
      formData.append('tags', JSON.stringify(formTags));
      formData.append('image', formFile);

      const response = await fetch('/api/image-materials', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        toast.success('作成しました');
        setCreateDialogOpen(false);
        resetForm();
        loadMaterials();
      } else {
        toast.error(data.error || '作成に失敗しました');
      }
    } catch (error) {
      console.error('Failed to create image material:', error);
      toast.error('作成に失敗しました');
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedMaterial || !formName.trim()) {
      toast.error('名前を入力してください');
      return;
    }

    try {
      setSubmitting(true);

      const body = {
        name: formName.trim(),
        description: formDescription.trim(),
        category: formCategory,
        tags: formTags,
      };

      const response = await fetch(`/api/image-materials/${selectedMaterial.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('更新しました');
        setEditDialogOpen(false);
        resetForm();
        loadMaterials();
      } else {
        toast.error(data.error || '更新に失敗しました');
      }
    } catch (error) {
      console.error('Failed to update image material:', error);
      toast.error('更新に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormCategory('背景');
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
      // ファイルタイプチェック
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast.error('PNG, JPG, JPEG, WEBP形式のファイルのみアップロード可能です');
        return;
      }

      // ファイルサイズチェック（10MB）
      if (file.size > 10 * 1024 * 1024) {
        toast.error('ファイルサイズは10MB以下にしてください');
        return;
      }

      setFormFile(file);

      // プレビュー用のURLを生成
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

  const openEditDialog = (material: ImageMaterial) => {
    setSelectedMaterial(material);
    setFormName(material.name);
    setFormDescription(material.description);
    setFormCategory(material.category);
    setFormTags(material.tags);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (material: ImageMaterial) => {
    setSelectedMaterial(material);
    setDeleteDialogOpen(true);
  };

  const openImageEditor = (material: ImageMaterial) => {
    // GCP署名付きURLではなく、/api/storage経由のURLを使用
    const proxyUrl = `/api/storage/${material.file_name}`;
    setEditingImageUrl(proxyUrl);
    setEditingMaterial(material); // イメージエディタ専用の状態に設定
    setImageEditorOpen(true);
  };

  const handleSaveEditedImage = async (blob: Blob, saveMode?: 'overwrite' | 'new') => {
    // イメージエディタ専用の状態を使用（selectedMaterialではなくeditingMaterial）
    if (!editingMaterial) {
      toast.error('素材が選択されていません');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('image', blob);

      let response;
      let successMessage;

      if (saveMode === 'new') {
        // 新規保存: 元の素材情報をコピーして新規作成
        formData.append('name', `${editingMaterial.name} (編集済み)`);
        formData.append('description', editingMaterial.description);
        formData.append('category', editingMaterial.category);
        formData.append('tags', JSON.stringify(editingMaterial.tags));

        response = await fetch('/api/image-materials', {
          method: 'POST',
          body: formData,
        });
        successMessage = '新しい素材として保存しました';
      } else {
        // 上書き保存（デフォルト）: editingMaterialのIDを使用
        response = await fetch(`/api/image-materials/${editingMaterial.id}/replace-image`, {
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
        setEditingMaterial(null); // イメージエディタ専用の状態をクリア
        loadMaterials();
      } else {
        toast.error(data.error || '画像の保存に失敗しました');
      }
    } catch (error) {
      console.error('Failed to save edited image:', error);
      toast.error('画像の保存に失敗しました');
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
            画像素材マスタ
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ワークフローで使用する画像素材を管理します
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
                <TableCell>サイズ</TableCell>
                <TableCell>ファイルサイズ</TableCell>
                <TableCell>タグ</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {materials.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      画像素材がありません
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                materials.map((material) => (
                  <TableRow key={material.id} hover>
                    <TableCell>
                      <Box
                        component="img"
                        src={material.signed_url || ''}
                        alt={material.name}
                        sx={{
                          width: 80,
                          height: 80,
                          objectFit: 'cover',
                          borderRadius: 1,
                          bgcolor: 'grey.100',
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder-image.png';
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {material.name}
                      </Typography>
                      {material.description && (
                        <Typography variant="caption" color="text.secondary">
                          {material.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={material.category} size="small" />
                    </TableCell>
                    <TableCell>
                      {material.width && material.height
                        ? `${material.width} × ${material.height}`
                        : '-'}
                    </TableCell>
                    <TableCell>{formatFileSize(material.file_size_bytes)}</TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        {material.tags.slice(0, 3).map((tag, index) => (
                          <Chip key={index} label={tag} size="small" variant="outlined" />
                        ))}
                        {material.tags.length > 3 && (
                          <Chip
                            label={`+${material.tags.length - 3}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => openImageEditor(material)}
                        color="secondary"
                        title="画像を編集"
                      >
                        <BrushIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => openEditDialog(material)}
                        color="primary"
                        title="メタデータを編集"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => openDeleteDialog(material)}
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
        <DialogTitle>画像素材を追加</DialogTitle>
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
                id="image-upload-input"
              />
              <label htmlFor="image-upload-input">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<CloudUploadIcon />}
                  fullWidth
                  sx={{ py: 2 }}
                >
                  {formFile ? formFile.name : '画像ファイルを選択（PNG, JPG, WEBP, 最大10MB）'}
                </Button>
              </label>
              {previewUrl && (
                <Box mt={2} textAlign="center">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '300px',
                      borderRadius: '8px',
                    }}
                  />
                </Box>
              )}
            </Box>

            <TextField
              label="素材名"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              fullWidth
              required
            />

            <FormControl fullWidth>
              <InputLabel>カテゴリ</InputLabel>
              <Select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                label="カテゴリ"
              >
                {IMAGE_MATERIAL_CATEGORIES.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="説明"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
            />

            <Autocomplete
              multiple
              freeSolo
              options={[]}
              value={formTags}
              onChange={(_, newValue) => setFormTags(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="タグ"
                  placeholder="タグを入力してEnter"
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
            onClick={handleCreate}
            variant="contained"
            disabled={submitting || !formName.trim() || !formFile}
          >
            {uploading ? 'アップロード中...' : '作成'}
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
        <DialogTitle>画像素材を編集</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {selectedMaterial?.signed_url && (
              <Box textAlign="center">
                <img
                  src={selectedMaterial.signed_url}
                  alt={selectedMaterial.name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '300px',
                    borderRadius: '8px',
                  }}
                />
                <Box mt={2}>
                  <Button
                    variant="outlined"
                    startIcon={<BrushIcon />}
                    onClick={() => {
                      setEditDialogOpen(false);
                      openImageEditor(selectedMaterial);
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

            <TextField
              label="素材名"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              fullWidth
              required
            />

            <FormControl fullWidth>
              <InputLabel>カテゴリ</InputLabel>
              <Select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                label="カテゴリ"
              >
                {IMAGE_MATERIAL_CATEGORIES.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="説明"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
            />

            <Autocomplete
              multiple
              freeSolo
              options={[]}
              value={formTags}
              onChange={(_, newValue) => setFormTags(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="タグ"
                  placeholder="タグを入力してEnter"
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
            onClick={handleUpdate}
            variant="contained"
            disabled={submitting || !formName.trim()}
          >
            更新
          </Button>
        </DialogActions>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>画像素材を削除</DialogTitle>
        <DialogContent>
          <Typography>
            「{selectedMaterial?.name}」を削除してもよろしいですか？
          </Typography>
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            この操作は取り消せません。GCP Storageからも画像ファイルが削除されます。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
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
            setEditingMaterial(null); // イメージエディタ専用の状態をクリア
          }}
          enableSaveModeSelection={true}
        />
      )}
    </Container>
  );
}
