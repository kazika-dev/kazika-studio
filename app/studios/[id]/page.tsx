'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Button,
  IconButton,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Stack,
  Chip,
  Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import StudioBoard from '@/components/studio/StudioBoard';

interface Studio {
  id: number;
  name: string;
  description: string;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
  metadata: any;
}

interface Board {
  id: number;
  studio_id: number;
  sequence_order: number;
  title: string;
  description: string;
  workflow_id: number | null;
  audio_output_id: number | null;
  image_output_id: number | null;
  video_output_id: number | null;
  custom_audio_url: string | null;
  custom_image_url: string | null;
  custom_video_url: string | null;
  prompt_text: string;
  duration_seconds: number | null;
  status: 'draft' | 'processing' | 'completed' | 'error';
  error_message: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export default function StudioDetailPage() {
  const router = useRouter();
  const params = useParams();

  // paramsからIDを安全に取得
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const studioId = idParam ? parseInt(idParam, 10) : NaN;

  const [studio, setStudio] = useState<Studio | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 編集ダイアログ
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // 新規ボード作成ダイアログ
  const [createBoardDialogOpen, setCreateBoardDialogOpen] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [newBoardPrompt, setNewBoardPrompt] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isNaN(studioId) && studioId > 0) {
      loadStudio();
      loadBoards();
    } else if (idParam !== undefined) {
      // IDが不正な場合はエラーを設定
      setError('無効なスタジオIDです');
      setLoading(false);
    }
  }, [studioId, idParam]);

  const loadStudio = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/studios/${studioId}`);
      const data = await response.json();

      if (data.success) {
        setStudio(data.studio);
        setEditName(data.studio.name);
        setEditDescription(data.studio.description);
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

  const loadBoards = async () => {
    try {
      const response = await fetch(`/api/studios/${studioId}/boards`);
      const data = await response.json();

      if (data.success) {
        setBoards(data.boards);
      } else {
        console.error('ボードの読み込みに失敗:', data.error);
      }
    } catch (err: any) {
      console.error('ボードの読み込み中にエラー:', err);
    }
  };

  const handleSaveStudio = async () => {
    if (!editName.trim()) {
      alert('プロジェクト名を入力してください');
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(`/api/studios/${studioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setStudio(data.studio);
        setEditDialogOpen(false);
      } else {
        alert(data.error || 'スタジオの更新に失敗しました');
      }
    } catch (err: any) {
      alert('スタジオの更新中にエラーが発生しました');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBoard = async () => {
    try {
      setCreating(true);

      // 新しいボードのsequence_orderは既存ボードの最後
      const nextOrder = boards.length;

      const response = await fetch(`/api/studios/${studioId}/boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sequence_order: nextOrder,
          title: newBoardTitle.trim() || `シーン ${nextOrder + 1}`,
          prompt_text: newBoardPrompt.trim(),
          duration_seconds: 5.0,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setBoards([...boards, data.board]);
        setCreateBoardDialogOpen(false);
        setNewBoardTitle('');
        setNewBoardPrompt('');
      } else {
        alert(data.error || 'ボードの作成に失敗しました');
      }
    } catch (err: any) {
      alert('ボードの作成中にエラーが発生しました');
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleBoardUpdate = (updatedBoard: Board) => {
    setBoards(boards.map(b => b.id === updatedBoard.id ? updatedBoard : b));
  };

  const handleBoardDelete = (boardId: number) => {
    setBoards(boards.filter(b => b.id !== boardId));
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>読み込み中...</Typography>
      </Container>
    );
  }

  if (error || !studio) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">{error || 'スタジオが見つかりません'}</Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/studios')}
          sx={{ mt: 2 }}
        >
          スタジオ一覧に戻る
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 4 }}>
        <Button
          variant="text"
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/studios')}
          sx={{ mb: 2 }}
        >
          スタジオ一覧に戻る
        </Button>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              {studio.name}
            </Typography>
            {studio.description && (
              <Typography variant="body1" color="text.secondary">
                {studio.description}
              </Typography>
            )}
          </Box>
          <IconButton onClick={() => setEditDialogOpen(true)} size="large">
            <EditIcon />
          </IconButton>
        </Box>
      </Box>

      {/* ストーリーボードタイムライン */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" fontWeight={600}>
            ストーリーボード
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateBoardDialogOpen(true)}
          >
            シーンを追加
          </Button>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {boards.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              シーンがありません
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              シーンを追加してストーリーボードを作成しましょう
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateBoardDialogOpen(true)}
            >
              最初のシーンを追加
            </Button>
          </Box>
        ) : (
          <Stack spacing={3}>
            {boards.map((board, index) => (
              <StudioBoard
                key={board.id}
                board={board}
                index={index}
                onUpdate={handleBoardUpdate}
                onDelete={handleBoardDelete}
              />
            ))}
          </Stack>
        )}
      </Paper>

      {/* スタジオ編集ダイアログ */}
      <Dialog
        open={editDialogOpen}
        onClose={() => !saving && setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>プロジェクト編集</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="プロジェクト名"
            fullWidth
            required
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            sx={{ mt: 2, mb: 2 }}
          />
          <TextField
            label="説明"
            fullWidth
            multiline
            rows={3}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditDialogOpen(false)} disabled={saving}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSaveStudio}
            disabled={saving || !editName.trim()}
          >
            {saving ? <CircularProgress size={24} /> : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ボード作成ダイアログ */}
      <Dialog
        open={createBoardDialogOpen}
        onClose={() => !creating && setCreateBoardDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>新しいシーンを追加</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="シーンタイトル"
            fullWidth
            value={newBoardTitle}
            onChange={(e) => setNewBoardTitle(e.target.value)}
            sx={{ mt: 2, mb: 2 }}
            placeholder={`シーン ${boards.length + 1}`}
          />
          <TextField
            label="プロンプト"
            fullWidth
            multiline
            rows={4}
            value={newBoardPrompt}
            onChange={(e) => setNewBoardPrompt(e.target.value)}
            placeholder="このシーンで生成したい内容を入力..."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateBoardDialogOpen(false)} disabled={creating}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateBoard}
            disabled={creating}
          >
            {creating ? <CircularProgress size={24} /> : '作成'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
