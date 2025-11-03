'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface Studio {
  id: number;
  name: string;
  description: string;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
  metadata: any;
}

export default function StudiosPage() {
  const router = useRouter();
  const [studios, setStudios] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新規作成ダイアログ
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newStudioName, setNewStudioName] = useState('');
  const [newStudioDescription, setNewStudioDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // 削除確認ダイアログ
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studioToDelete, setStudioToDelete] = useState<Studio | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadStudios();
  }, []);

  const loadStudios = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/studios');
      const data = await response.json();

      if (data.success) {
        setStudios(data.studios);
      } else {
        setError(data.error || 'スタジオの読み込みに失敗しました');
      }
    } catch (err: any) {
      setError('スタジオの読み込み中にエラーが発生しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStudio = async () => {
    if (!newStudioName.trim()) {
      alert('プロジェクト名を入力してください');
      return;
    }

    try {
      setCreating(true);

      const response = await fetch('/api/studios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newStudioName.trim(),
          description: newStudioDescription.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setStudios([data.studio, ...studios]);
        setCreateDialogOpen(false);
        setNewStudioName('');
        setNewStudioDescription('');

        // 作成したスタジオの詳細ページに遷移
        router.push(`/studios/${data.studio.id}`);
      } else {
        alert(data.error || 'スタジオの作成に失敗しました');
      }
    } catch (err: any) {
      alert('スタジオの作成中にエラーが発生しました');
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteStudio = async () => {
    if (!studioToDelete) return;

    try {
      setDeleting(true);

      const response = await fetch(`/api/studios/${studioToDelete.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setStudios(studios.filter(s => s.id !== studioToDelete.id));
        setDeleteDialogOpen(false);
        setStudioToDelete(null);
      } else {
        alert(data.error || 'スタジオの削除に失敗しました');
      }
    } catch (err: any) {
      alert('スタジオの削除中にエラーが発生しました');
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteDialog = (studio: Studio) => {
    setStudioToDelete(studio);
    setDeleteDialogOpen(true);
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>読み込み中...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            スタジオ
          </Typography>
          <Typography variant="body1" color="text.secondary">
            動画プロジェクトを管理します
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="large"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{ px: 3 }}
        >
          新規プロジェクト
        </Button>
      </Box>

      {/* エラー表示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* スタジオ一覧 */}
      {studios.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            スタジオがありません
          </Typography>
          <Typography variant="body2" color="text.secondary">
            右上の「新規プロジェクト」ボタンから動画制作を始めましょう
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(1, 1fr)',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(4, 1fr)',
            },
            gap: 3,
          }}
        >
          {studios.map((studio) => (
            <Box key={studio.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
                onClick={() => router.push(`/studios/${studio.id}`)}
              >
                {studio.thumbnail_url ? (
                  <CardMedia
                    component="img"
                    height="160"
                    image={studio.thumbnail_url}
                    alt={studio.name}
                    sx={{ objectFit: 'cover' }}
                  />
                ) : (
                  <Box
                    sx={{
                      height: 160,
                      bgcolor: 'grey.200',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PlayArrowIcon sx={{ fontSize: 64, color: 'grey.400' }} />
                  </Box>
                )}

                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" fontWeight={600} gutterBottom noWrap>
                    {studio.name}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      minHeight: '2.5em',
                    }}
                  >
                    {studio.description || '説明なし'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    {formatDistanceToNow(new Date(studio.updated_at), {
                      addSuffix: true,
                      locale: ja,
                    })}
                  </Typography>
                </CardContent>

                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/studios/${studio.id}`);
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteDialog(studio);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </CardActions>
              </Card>
            </Box>
          ))}
        </Box>
      )}

      {/* 新規作成ダイアログ */}
      <Dialog
        open={createDialogOpen}
        onClose={() => !creating && setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>新規プロジェクト作成</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="プロジェクト名"
            fullWidth
            required
            value={newStudioName}
            onChange={(e) => setNewStudioName(e.target.value)}
            sx={{ mt: 2, mb: 2 }}
            placeholder="例: 商品紹介動画"
          />
          <TextField
            label="説明"
            fullWidth
            multiline
            rows={3}
            value={newStudioDescription}
            onChange={(e) => setNewStudioDescription(e.target.value)}
            placeholder="プロジェクトの説明を入力..."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={creating}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateStudio}
            disabled={creating || !newStudioName.trim()}
          >
            {creating ? <CircularProgress size={24} /> : '作成'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleting && setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>スタジオを削除</DialogTitle>
        <DialogContent>
          <Typography>
            「{studioToDelete?.name}」を削除してもよろしいですか？
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            この操作は取り消せません。すべてのボードも削除されます。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteStudio}
            disabled={deleting}
          >
            {deleting ? <CircularProgress size={24} /> : '削除'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
