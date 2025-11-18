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
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ArrowBack as ArrowBackIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Upload as UploadIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { toast } from 'sonner';
import { Toaster } from 'sonner';

interface SoundEffect {
  id: number;
  name: string;
  description: string;
  file_name: string;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  category: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

const CATEGORIES = ['環境音', '効果音', 'BGM', 'その他'];

export default function SoundEffectsManager() {
  const router = useRouter();
  const [records, setRecords] = useState<SoundEffect[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<SoundEffect | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // フォーム状態
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('効果音');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formFile, setFormFile] = useState<File | null>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  useEffect(() => {
    // クリーンアップ: コンポーネントがアンマウントされたら音声を停止
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sound-effects');
      const data = await response.json();

      if (data.success) {
        setRecords(data.soundEffects);
      } else {
        toast.error('データの取得に失敗しました');
      }
    } catch (error) {
      console.error('Failed to load sound effects:', error);
      toast.error('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRecord) return;

    try {
      const response = await fetch(`/api/sound-effects/${selectedRecord.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('削除しました');
        loadRecords();
      } else {
        toast.error('削除に失敗しました');
      }
    } catch (error) {
      console.error('Failed to delete sound effect:', error);
      toast.error('削除に失敗しました');
    } finally {
      setDeleteDialogOpen(false);
      setSelectedRecord(null);
    }
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('名前を入力してください');
      return;
    }

    if (!formFile) {
      toast.error('音声ファイルを選択してください');
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
      formData.append('audio', formFile);

      const response = await fetch('/api/sound-effects', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        toast.success('作成しました');
        setCreateDialogOpen(false);
        resetForm();
        loadRecords();
      } else {
        toast.error(data.error || '作成に失敗しました');
      }
    } catch (error) {
      console.error('Failed to create sound effect:', error);
      toast.error('作成に失敗しました');
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedRecord || !formName.trim()) {
      toast.error('名前を入力してください');
      return;
    }

    try {
      setSubmitting(true);

      const body: any = {
        name: formName.trim(),
        description: formDescription.trim(),
        category: formCategory,
        tags: formTags,
      };

      // ファイルが選択されている場合はFormDataを使用
      let requestBody;
      let headers: HeadersInit = {};

      if (formFile) {
        setUploading(true);
        const formData = new FormData();
        formData.append('name', formName.trim());
        formData.append('description', formDescription.trim());
        formData.append('category', formCategory);
        formData.append('tags', JSON.stringify(formTags));
        formData.append('audio', formFile);
        requestBody = formData;
      } else {
        headers = { 'Content-Type': 'application/json' };
        requestBody = JSON.stringify(body);
      }

      const response = await fetch(`/api/sound-effects/${selectedRecord.id}`, {
        method: 'PUT',
        headers,
        body: requestBody,
      });

      const data = await response.json();

      if (data.success) {
        toast.success('更新しました');
        setEditDialogOpen(false);
        setSelectedRecord(null);
        resetForm();
        loadRecords();
      } else {
        toast.error(data.error || '更新に失敗しました');
      }
    } catch (error) {
      console.error('Failed to update sound effect:', error);
      toast.error('更新に失敗しました');
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const handlePlay = async (record: SoundEffect) => {
    try {
      // 現在再生中の音声を停止
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      if (playingId === record.id) {
        // 同じ音声をクリックしたら停止
        setPlayingId(null);
        return;
      }

      // 音声ファイルをダウンロードして再生
      const response = await fetch(`/api/sound-effects/${record.id}/download`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setPlayingId(null);
        URL.revokeObjectURL(url);
      };

      audio.onerror = () => {
        toast.error('音声の再生に失敗しました');
        setPlayingId(null);
        URL.revokeObjectURL(url);
      };

      await audio.play();
      setPlayingId(record.id);
    } catch (error) {
      console.error('Failed to play sound effect:', error);
      toast.error('音声の再生に失敗しました');
      setPlayingId(null);
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormCategory('効果音');
    setFormTags([]);
    setFormFile(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
  };

  const openEditDialog = (record: SoundEffect) => {
    setSelectedRecord(record);
    setFormName(record.name);
    setFormDescription(record.description || '');
    setFormCategory(record.category || '効果音');
    setFormTags(record.tags || []);
    setFormFile(null);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (record: SoundEffect) => {
    setSelectedRecord(record);
    setDeleteDialogOpen(true);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => router.push('/master')}
        sx={{ mb: 2 }}
      >
        マスタ管理に戻る
      </Button>

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h5" component="h1" gutterBottom>
                効果音マスタ管理
              </Typography>
              <Typography variant="body2" color="text.secondary">
                効果音のマスタデータを管理します（GCP Storageに保存された音声ファイル）
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                テーブル: kazikastudio.m_sound_effects
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
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>名前</TableCell>
              <TableCell>説明</TableCell>
              <TableCell>カテゴリ</TableCell>
              <TableCell>タグ</TableCell>
              <TableCell>長さ</TableCell>
              <TableCell>サイズ</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id}>
                <TableCell>{record.id}</TableCell>
                <TableCell>{record.name}</TableCell>
                <TableCell>{record.description || '-'}</TableCell>
                <TableCell>
                  <Chip label={record.category} size="small" />
                </TableCell>
                <TableCell>
                  <Box display="flex" gap={0.5} flexWrap="wrap">
                    {record.tags.map((tag, index) => (
                      <Chip key={index} label={tag} size="small" variant="outlined" />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>{formatDuration(record.duration_seconds)}</TableCell>
                <TableCell>{formatFileSize(record.file_size_bytes)}</TableCell>
                <TableCell>
                  <Box display="flex" gap={0.5}>
                    <IconButton
                      size="small"
                      color={playingId === record.id ? 'secondary' : 'primary'}
                      onClick={() => playingId === record.id ? handleStop() : handlePlay(record)}
                      title={playingId === record.id ? '停止' : '再生'}
                    >
                      {playingId === record.id ? <StopIcon /> : <PlayArrowIcon />}
                    </IconButton>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => openEditDialog(record)}
                      title="編集"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => openDeleteDialog(record)}
                      title="削除"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {records.length === 0 && (
        <Box textAlign="center" py={4}>
          <Typography variant="body1" color="text.secondary">
            効果音が登録されていません
          </Typography>
        </Box>
      )}

      {/* 作成ダイアログ */}
      <Dialog open={createDialogOpen} onClose={() => !submitting && setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>効果音を作成</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="名前"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="説明"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                multiline
                rows={2}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel>カテゴリ</InputLabel>
                <Select
                  value={formCategory}
                  label="カテゴリ"
                  onChange={(e) => setFormCategory(e.target.value)}
                >
                  {CATEGORIES.map((cat) => (
                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Autocomplete
                multiple
                freeSolo
                options={[]}
                value={formTags}
                onChange={(_, newValue) => setFormTags(newValue)}
                renderInput={(params) => (
                  <TextField {...params} label="タグ" placeholder="Enterでタグを追加" />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Button
                variant="outlined"
                component="label"
                fullWidth
                startIcon={<CloudUploadIcon />}
              >
                {formFile ? formFile.name : '音声ファイルを選択'}
                <input
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                />
              </Button>
              {formFile && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {formatFileSize(formFile.size)}
                </Typography>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={submitting}>
            キャンセル
          </Button>
          <Button onClick={handleCreate} variant="contained" disabled={submitting}>
            {uploading ? <CircularProgress size={24} /> : '作成'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 編集ダイアログ */}
      <Dialog open={editDialogOpen} onClose={() => !submitting && setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>効果音を編集</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="名前"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="説明"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                multiline
                rows={2}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel>カテゴリ</InputLabel>
                <Select
                  value={formCategory}
                  label="カテゴリ"
                  onChange={(e) => setFormCategory(e.target.value)}
                >
                  {CATEGORIES.map((cat) => (
                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Autocomplete
                multiple
                freeSolo
                options={[]}
                value={formTags}
                onChange={(_, newValue) => setFormTags(newValue)}
                renderInput={(params) => (
                  <TextField {...params} label="タグ" placeholder="Enterでタグを追加" />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Button
                variant="outlined"
                component="label"
                fullWidth
                startIcon={<CloudUploadIcon />}
              >
                {formFile ? formFile.name : '音声ファイルを変更（オプション）'}
                <input
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                />
              </Button>
              {formFile && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {formatFileSize(formFile.size)}
                </Typography>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} disabled={submitting}>
            キャンセル
          </Button>
          <Button onClick={handleUpdate} variant="contained" disabled={submitting}>
            {uploading ? <CircularProgress size={24} /> : '更新'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>削除確認</DialogTitle>
        <DialogContent>
          <Typography>
            「{selectedRecord?.name}」を削除してもよろしいですか？
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            この操作は取り消せません。GCP Storage上のファイルも削除されます。
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
    </Container>
  );
}
