'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  IconButton,
  Typography,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Container,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { toast } from 'sonner';
import { Toaster } from 'sonner';

interface ElevenLabsTag {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

interface EditingTag {
  id: number;
  name: string;
  description: string;
}

export default function ElevenLabsTagsPage() {
  const [tags, setTags] = useState<ElevenLabsTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<ElevenLabsTag | null>(null);
  const [mounted, setMounted] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<EditingTag | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newTag, setNewTag] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/eleven-labs-tags');
      const data = await response.json();

      if (data.success) {
        setTags(data.tags);
      } else {
        toast.error('タグの取得に失敗しました');
      }
    } catch (error) {
      console.error('Failed to load tags:', error);
      toast.error('タグの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (tag: ElevenLabsTag) => {
    setEditingId(tag.id);
    setEditingData({
      id: tag.id,
      name: tag.name,
      description: tag.description,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingData(null);
  };

  const handleSaveEdit = async () => {
    if (!editingData || !editingData.name.trim()) {
      toast.error('タグ名を入力してください');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/eleven-labs-tags/${editingData.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editingData.name.trim(),
          description: editingData.description.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('タグを更新しました');
        setEditingId(null);
        setEditingData(null);
        loadTags();
      } else {
        toast.error(data.error || 'タグの更新に失敗しました');
      }
    } catch (error: any) {
      console.error('Failed to update tag:', error);
      toast.error(error.message || 'タグの更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleStartAdd = () => {
    setIsAdding(true);
    setNewTag({ name: '', description: '' });
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewTag({ name: '', description: '' });
  };

  const handleSaveNew = async () => {
    if (!newTag.name.trim()) {
      toast.error('タグ名を入力してください');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/eleven-labs-tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newTag.name.trim(),
          description: newTag.description.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('タグを作成しました');
        setIsAdding(false);
        setNewTag({ name: '', description: '' });
        loadTags();
      } else {
        toast.error(data.error || 'タグの作成に失敗しました');
      }
    } catch (error: any) {
      console.error('Failed to create tag:', error);
      toast.error(error.message || 'タグの作成に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTag) return;

    try {
      const response = await fetch(`/api/eleven-labs-tags/${selectedTag.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('タグを削除しました');
        loadTags();
      } else {
        toast.error('タグの削除に失敗しました');
      }
    } catch (error) {
      console.error('Failed to delete tag:', error);
      toast.error('タグの削除に失敗しました');
    } finally {
      setDeleteDialogOpen(false);
      setSelectedTag(null);
    }
  };

  // クライアントサイドでマウントされるまで何も表示しない（Hydrationエラー回避）
  if (!mounted) {
    return null;
  }

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Toaster position="top-center" />

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            ElevenLabs タグ
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ElevenLabsのタグマスタを管理します
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleStartAdd}
          disabled={isAdding}
        >
          新規追加
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width="25%">タグ名</TableCell>
              <TableCell width="55%">説明</TableCell>
              <TableCell width="20%" align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isAdding && (
              <TableRow>
                <TableCell>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="frustrated, cheerful..."
                    value={newTag.name}
                    onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                    disabled={saving}
                    autoFocus
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="説明を入力（任意）"
                    value={newTag.description}
                    onChange={(e) => setNewTag({ ...newTag, description: e.target.value })}
                    disabled={saving}
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={handleSaveNew}
                    disabled={saving}
                    title="保存"
                  >
                    <CheckIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={handleCancelAdd}
                    disabled={saving}
                    title="キャンセル"
                  >
                    <CloseIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            )}
            {tags.length === 0 && !isAdding ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 8 }}>
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    タグがまだありません
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleStartAdd}
                    sx={{ mt: 2 }}
                  >
                    最初のタグを作成
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              tags.map((tag) => (
                <TableRow key={tag.id} hover>
                  {editingId === tag.id && editingData ? (
                    <>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          value={editingData.name}
                          onChange={(e) =>
                            setEditingData({ ...editingData, name: e.target.value })
                          }
                          disabled={saving}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          value={editingData.description}
                          onChange={(e) =>
                            setEditingData({ ...editingData, description: e.target.value })
                          }
                          disabled={saving}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={handleSaveEdit}
                          disabled={saving}
                          title="保存"
                        >
                          <CheckIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={handleCancelEdit}
                          disabled={saving}
                          title="キャンセル"
                        >
                          <CloseIcon />
                        </IconButton>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>
                        <Typography variant="body2">{tag.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {tag.description || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleStartEdit(tag)}
                          title="編集"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            setSelectedTag(tag);
                            setDeleteDialogOpen(true);
                          }}
                          title="削除"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>タグを削除しますか？</DialogTitle>
        <DialogContent>
          <DialogContentText>
            この操作は取り消せません。タグ「{selectedTag?.name}」を削除してもよろしいですか?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={handleDelete} color="error" autoFocus>
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
