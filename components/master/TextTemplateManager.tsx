'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Typography,
  CircularProgress,
  Grid,
  Card,
  CardMedia,
  CardActions,
  Tooltip,
  Badge,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ImageIcon from '@mui/icons-material/Image';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import { TextTemplateMedia } from '@/types/text-template';

interface TextTemplate {
  id: number;
  name: string;
  name_ja?: string;
  content: string;
  description?: string;
  description_ja?: string;
  category: string;
  tags: string[];
  is_active: boolean;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

const CATEGORIES = [
  { value: 'general', label: '汎用' },
  { value: 'prompt', label: 'プロンプト' },
  { value: 'scene', label: 'シーン描写' },
  { value: 'character', label: 'キャラクター' },
  { value: 'narration', label: 'ナレーション' },
  { value: 'system', label: 'システムプロンプト' },
];

export default function TextTemplateManager() {
  const [templates, setTemplates] = useState<TextTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TextTemplate | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<TextTemplate | null>(null);

  // メディア関連
  const [mediaList, setMediaList] = useState<TextTemplateMedia[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaByTemplate, setMediaByTemplate] = useState<Record<number, TextTemplateMedia[]>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // メディアプレビュー
  const [previewMedia, setPreviewMedia] = useState<TextTemplateMedia | null>(null);

  // フォーム入力状態
  const [formData, setFormData] = useState({
    name: '',
    name_ja: '',
    content: '',
    description: '',
    description_ja: '',
    category: 'general',
    tags: [] as string[],
    is_active: true,
  });
  const [tagInput, setTagInput] = useState('');

  // カテゴリフィルター
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/master-tables/m_text_templates');
      if (!response.ok) throw new Error('Failed to fetch templates');
      const result = await response.json();
      setTemplates(result.data || []);
      setError(null);

      // メディアを取得
      const mediaMap: Record<number, TextTemplateMedia[]> = {};
      for (const template of result.data || []) {
        try {
          const mediaResponse = await fetch(`/api/text-templates/${template.id}/media`);
          if (mediaResponse.ok) {
            const mediaResult = await mediaResponse.json();
            mediaMap[template.id] = mediaResult.media || [];
          }
        } catch (err) {
          // エラーは無視
        }
      }
      setMediaByTemplate(mediaMap);
    } catch (err: any) {
      console.error('Load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMedia = async (templateId: number) => {
    try {
      setMediaLoading(true);
      const response = await fetch(`/api/text-templates/${templateId}/media`);
      if (!response.ok) throw new Error('Failed to fetch media');
      const result = await response.json();
      setMediaList(result.media || []);
    } catch (err: any) {
      console.error('Media load error:', err);
    } finally {
      setMediaLoading(false);
    }
  };

  const handleOpenDialog = async (template?: TextTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        name_ja: template.name_ja || '',
        content: template.content,
        description: template.description || '',
        description_ja: template.description_ja || '',
        category: template.category,
        tags: template.tags || [],
        is_active: template.is_active,
      });
      // メディアを読み込む
      await loadMedia(template.id);
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        name_ja: '',
        content: '',
        description: '',
        description_ja: '',
        category: 'general',
        tags: [],
        is_active: true,
      });
      setMediaList([]);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
    setTagInput('');
    setMediaList([]);
  };

  const handleSave = async () => {
    // Validate required fields
    if (!formData.name.trim() || !formData.content.trim()) {
      setError('名前とテンプレート本文は必須です');
      return;
    }

    // 二重クリック防止
    if (saving) return;

    setSaving(true);
    setError(null);

    try {
      const url = '/api/master-tables/m_text_templates';
      const method = editingTemplate ? 'PUT' : 'POST';

      // Trim all string fields before saving
      const trimmedData = {
        name: formData.name.trim(),
        name_ja: formData.name_ja.trim(),
        content: formData.content.trim(),
        description: formData.description.trim(),
        description_ja: formData.description_ja.trim(),
        category: formData.category,
        tags: formData.tags,
        is_active: formData.is_active,
      };

      const body = editingTemplate
        ? { ...trimmedData, id: editingTemplate.id }
        : trimmedData;

      console.log('Saving template:', { method, body });

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const responseData = await response.json();
      console.log('Save response:', responseData);

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to save template');
      }

      await loadTemplates();
      handleCloseDialog();
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = (template: TextTemplate) => {
    setTemplateToDelete(template);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!templateToDelete) return;

    try {
      const response = await fetch(
        `/api/master-tables/m_text_templates?id=${templateToDelete.id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Failed to delete template');

      await loadTemplates();
      setDeleteConfirmOpen(false);
      setTemplateToDelete(null);
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.message);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const handleDeleteTag = (tagToDelete: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag) => tag !== tagToDelete),
    });
  };

  // メディアアップロード
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !editingTemplate) return;

    setMediaUploading(true);

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`/api/text-templates/${editingTemplate.id}/media`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Upload failed');
        }

        const result = await response.json();
        setMediaList((prev) => [...prev, result.media]);
        setMediaByTemplate((prev) => ({
          ...prev,
          [editingTemplate.id]: [...(prev[editingTemplate.id] || []), result.media],
        }));
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message);
    } finally {
      setMediaUploading(false);
      // ファイル入力をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteMedia = async (mediaId: number) => {
    if (!editingTemplate) return;

    try {
      const response = await fetch(
        `/api/text-templates/${editingTemplate.id}/media/${mediaId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Delete failed');
      }

      setMediaList((prev) => prev.filter((m) => m.id !== mediaId));
      setMediaByTemplate((prev) => ({
        ...prev,
        [editingTemplate.id]: (prev[editingTemplate.id] || []).filter((m) => m.id !== mediaId),
      }));
    } catch (err: any) {
      console.error('Delete media error:', err);
      setError(err.message);
    }
  };

  const filteredTemplates = templates.filter(
    (t) => categoryFilter === 'all' || t.category === categoryFilter
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">テキストテンプレートマスタ</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          新規作成
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* カテゴリフィルター */}
      <Box sx={{ mb: 2 }}>
        <Chip
          label="すべて"
          onClick={() => setCategoryFilter('all')}
          color={categoryFilter === 'all' ? 'primary' : 'default'}
          sx={{ mr: 1 }}
        />
        {CATEGORIES.map((cat) => (
          <Chip
            key={cat.value}
            label={cat.label}
            onClick={() => setCategoryFilter(cat.value)}
            color={categoryFilter === cat.value ? 'primary' : 'default'}
            sx={{ mr: 1 }}
          />
        ))}
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>名前</TableCell>
              <TableCell>カテゴリ</TableCell>
              <TableCell>タグ</TableCell>
              <TableCell>内容プレビュー</TableCell>
              <TableCell>メディア</TableCell>
              <TableCell>アクション</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTemplates.map((template) => (
              <TableRow key={template.id}>
                <TableCell>{template.id}</TableCell>
                <TableCell>
                  {template.name_ja || template.name}
                </TableCell>
                <TableCell>
                  {CATEGORIES.find((c) => c.value === template.category)?.label || template.category}
                </TableCell>
                <TableCell>
                  {template.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="small" sx={{ mr: 0.5 }} />
                  ))}
                </TableCell>
                <TableCell>
                  {template.content.substring(0, 50)}
                  {template.content.length > 50 ? '...' : ''}
                </TableCell>
                <TableCell>
                  {mediaByTemplate[template.id]?.length > 0 ? (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', maxWidth: 200 }}>
                      {mediaByTemplate[template.id].slice(0, 4).map((media) => (
                        <Box
                          key={media.id}
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 0.5,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            position: 'relative',
                            bgcolor: 'grey.200',
                            '&:hover': { opacity: 0.8 },
                          }}
                          onClick={() => setPreviewMedia(media)}
                        >
                          {media.media_type === 'image' ? (
                            <Box
                              component="img"
                              src={media.signed_url}
                              alt=""
                              sx={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                            />
                          ) : (
                            <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
                              <video
                                src={media.signed_url}
                                preload="metadata"
                                muted
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                }}
                                onLoadedMetadata={(e) => {
                                  e.currentTarget.currentTime = 0.1;
                                }}
                              />
                              <VideoLibraryIcon
                                sx={{
                                  position: 'absolute',
                                  top: '50%',
                                  left: '50%',
                                  transform: 'translate(-50%, -50%)',
                                  fontSize: 16,
                                  color: 'white',
                                  filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.8))',
                                }}
                              />
                            </Box>
                          )}
                        </Box>
                      ))}
                      {mediaByTemplate[template.id].length > 4 && (
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 0.5,
                            bgcolor: 'grey.300',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            +{mediaByTemplate[template.id].length - 4}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">-</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpenDialog(template)} size="small">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDeleteConfirm(template)} size="small">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 編集ダイアログ */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingTemplate ? 'テンプレート編集' : '新規テンプレート作成'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="名前（英語）"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <TextField
              label="名前（日本語）"
              value={formData.name_ja}
              onChange={(e) => setFormData({ ...formData, name_ja: e.target.value })}
            />
            <TextField
              label="テンプレート本文"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              multiline
              rows={6}
              required
            />
            <TextField
              label="説明（英語）"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={2}
            />
            <TextField
              label="説明（日本語）"
              value={formData.description_ja}
              onChange={(e) => setFormData({ ...formData, description_ja: e.target.value })}
              multiline
              rows={2}
            />
            <FormControl fullWidth>
              <InputLabel>カテゴリ</InputLabel>
              <Select
                value={formData.category}
                label="カテゴリ"
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {CATEGORIES.map((cat) => (
                  <MenuItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* タグ入力 */}
            <Box>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  label="タグを追加"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  size="small"
                  fullWidth
                />
                <Button onClick={handleAddTag} variant="outlined">
                  追加
                </Button>
              </Box>
              <Box>
                {formData.tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    onDelete={() => handleDeleteTag(tag)}
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                ))}
              </Box>
            </Box>

            {/* 参考メディアセクション（編集時のみ表示） */}
            {editingTemplate && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  参考メディア
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  テンプレートの使用例として画像・動画をアップロードできます（画像: 10MB以下、動画: 100MB以下）
                </Typography>

                {/* ファイル入力（非表示） */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,video/mp4,video/mov,video/quicktime,video/webm"
                  multiple
                  style={{ display: 'none' }}
                />

                {/* アップロードボタン */}
                <Button
                  variant="outlined"
                  startIcon={mediaUploading ? <CircularProgress size={20} /> : <CloudUploadIcon />}
                  onClick={handleFileSelect}
                  disabled={mediaUploading}
                  sx={{ mb: 2 }}
                >
                  {mediaUploading ? 'アップロード中...' : 'メディアを追加'}
                </Button>

                {/* メディア読み込み中 */}
                {mediaLoading && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                )}

                {/* メディアグリッド */}
                {!mediaLoading && mediaList.length > 0 && (
                  <Grid container spacing={2}>
                    {mediaList.map((media) => (
                      <Grid size={{ xs: 6, sm: 4, md: 3 }} key={media.id}>
                        <Card sx={{ position: 'relative' }}>
                          <Box
                            sx={{
                              cursor: 'pointer',
                              '&:hover': { opacity: 0.8 },
                            }}
                            onClick={() => setPreviewMedia(media)}
                          >
                            {media.media_type === 'image' ? (
                              <CardMedia
                                component="img"
                                height="120"
                                image={media.signed_url}
                                alt={media.original_name || 'Media'}
                                sx={{ objectFit: 'cover' }}
                              />
                            ) : (
                              <Box
                                sx={{
                                  height: 120,
                                  position: 'relative',
                                  bgcolor: 'grey.900',
                                  overflow: 'hidden',
                                }}
                              >
                                <video
                                  src={media.signed_url}
                                  preload="metadata"
                                  muted
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                  }}
                                  onLoadedMetadata={(e) => {
                                    // 最初のフレームを表示するために少しシーク
                                    const video = e.currentTarget;
                                    video.currentTime = 0.1;
                                  }}
                                />
                                {/* 再生アイコンオーバーレイ */}
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    bgcolor: 'rgba(0,0,0,0.6)',
                                    borderRadius: '50%',
                                    width: 40,
                                    height: 40,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <VideoLibraryIcon sx={{ color: 'white', fontSize: 24 }} />
                                </Box>
                              </Box>
                            )}
                          </Box>
                          <CardActions sx={{ p: 0.5, justifyContent: 'space-between' }}>
                            <Tooltip title={media.media_type === 'image' ? '画像' : '動画'}>
                              {media.media_type === 'image' ? (
                                <ImageIcon fontSize="small" color="action" />
                              ) : (
                                <VideoLibraryIcon fontSize="small" color="action" />
                              )}
                            </Tooltip>
                            <Tooltip title="削除">
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteMedia(media.id)}
                                color="error"
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </CardActions>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}

                {/* メディアがない場合 */}
                {!mediaLoading && mediaList.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    参考メディアはまだありません
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving}>キャンセル</Button>
          <Button
            type="button"
            onClick={handleSave}
            variant="contained"
            disabled={saving || !formData.name.trim() || !formData.content.trim()}
          >
            {saving ? <CircularProgress size={20} /> : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>削除確認</DialogTitle>
        <DialogContent>
          <Typography>
            テンプレート「{templateToDelete?.name_ja || templateToDelete?.name}」を削除しますか？
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            関連する参考メディアも全て削除されます。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>キャンセル</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            削除
          </Button>
        </DialogActions>
      </Dialog>

      {/* メディアプレビューダイアログ */}
      <Dialog
        open={!!previewMedia}
        onClose={() => setPreviewMedia(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {previewMedia?.media_type === 'image' ? (
              <ImageIcon />
            ) : (
              <VideoLibraryIcon />
            )}
            <Typography component="span">
              {previewMedia?.original_name || 'メディアプレビュー'}
            </Typography>
          </Box>
          <IconButton onClick={() => setPreviewMedia(null)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2 }}>
          {previewMedia?.media_type === 'image' ? (
            <Box
              component="img"
              src={previewMedia?.signed_url}
              alt={previewMedia?.original_name || 'Preview'}
              sx={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain',
              }}
            />
          ) : (
            <Box
              component="video"
              src={previewMedia?.signed_url}
              controls
              autoPlay
              sx={{
                maxWidth: '100%',
                maxHeight: '70vh',
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
