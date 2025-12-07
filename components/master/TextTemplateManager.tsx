'use client';

import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

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
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TextTemplate | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<TextTemplate | null>(null);

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
    } catch (err: any) {
      console.error('Load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (template?: TextTemplate) => {
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
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
    setTagInput('');
  };

  const handleSave = async () => {
    // Validate required fields
    if (!formData.name.trim() || !formData.content.trim()) {
      setError('名前とテンプレート本文は必須です');
      return;
    }

    try {
      const url = editingTemplate
        ? '/api/master-tables/m_text_templates'
        : '/api/master-tables/m_text_templates';

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

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save template');
      }

      await loadTemplates();
      handleCloseDialog();
      setError(null);
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message);
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>キャンセル</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!formData.name.trim() || !formData.content.trim()}
          >
            保存
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>キャンセル</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
