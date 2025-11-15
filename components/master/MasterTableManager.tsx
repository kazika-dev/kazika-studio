'use client';

import { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { toast } from 'sonner';
import { Toaster } from 'sonner';

interface MasterRecord {
  id: number;
  name: string;
  description?: string;
  name_ja?: string;
  description_ja?: string;
  created_at?: string;
  updated_at?: string;
}

interface MasterTableManagerProps {
  tableName: string;
  displayName: string;
  description: string;
  showJapaneseFields?: boolean; // 日本語フィールドを表示するかどうか（デフォルト: false）
}

export default function MasterTableManager({
  tableName,
  displayName,
  description,
  showJapaneseFields = false,
}: MasterTableManagerProps) {
  const router = useRouter();
  const [records, setRecords] = useState<MasterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MasterRecord | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formNameJa, setFormNameJa] = useState('');
  const [formDescriptionJa, setFormDescriptionJa] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadRecords();
  }, [tableName]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/master-tables/${tableName}`);
      const data = await response.json();

      if (data.success) {
        setRecords(data.data);
      } else {
        toast.error('データの取得に失敗しました');
      }
    } catch (error) {
      console.error('Failed to load records:', error);
      toast.error('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRecord) return;

    try {
      const response = await fetch(`/api/master-tables/${tableName}?id=${selectedRecord.id}`, {
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
      console.error('Failed to delete record:', error);
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

    try {
      setSubmitting(true);
      const response = await fetch(`/api/master-tables/${tableName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim(),
          name_ja: formNameJa.trim(),
          description_ja: formDescriptionJa.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('作成しました');
        setCreateDialogOpen(false);
        setFormName('');
        setFormDescription('');
        setFormNameJa('');
        setFormDescriptionJa('');
        loadRecords();
      } else {
        toast.error(data.error || '作成に失敗しました');
      }
    } catch (error) {
      console.error('Failed to create record:', error);
      toast.error('作成に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedRecord || !formName.trim()) {
      toast.error('名前を入力してください');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/master-tables/${tableName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedRecord.id,
          name: formName.trim(),
          description: formDescription.trim(),
          name_ja: formNameJa.trim(),
          description_ja: formDescriptionJa.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('更新しました');
        setEditDialogOpen(false);
        setSelectedRecord(null);
        setFormName('');
        setFormDescription('');
        setFormNameJa('');
        setFormDescriptionJa('');
        loadRecords();
      } else {
        toast.error(data.error || '更新に失敗しました');
      }
    } catch (error) {
      console.error('Failed to update record:', error);
      toast.error('更新に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const openCreateDialog = () => {
    setFormName('');
    setFormDescription('');
    setFormNameJa('');
    setFormDescriptionJa('');
    setCreateDialogOpen(true);
  };

  const openEditDialog = (record: MasterRecord) => {
    setSelectedRecord(record);
    setFormName(record.name);
    setFormDescription(record.description || '');
    setFormNameJa(record.name_ja || '');
    setFormDescriptionJa(record.description_ja || '');
    setEditDialogOpen(true);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ja-JP');
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

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {displayName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
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

      {records.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              データがまだありません
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreateDialog}
              sx={{ mt: 2 }}
            >
              最初のデータを作成
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>名前{showJapaneseFields && ' (EN)'}</TableCell>
                {showJapaneseFields && <TableCell>名前 (JA)</TableCell>}
                <TableCell>説明{showJapaneseFields && ' (EN)'}</TableCell>
                {showJapaneseFields && <TableCell>説明 (JA)</TableCell>}
                <TableCell>作成日時</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id} hover>
                  <TableCell>
                    <Chip label={record.id} size="small" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {record.name}
                    </Typography>
                  </TableCell>
                  {showJapaneseFields && (
                    <TableCell>
                      <Typography variant="body1" fontWeight="medium">
                        {record.name_ja || '-'}
                      </Typography>
                    </TableCell>
                  )}
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {record.description || '-'}
                    </Typography>
                  </TableCell>
                  {showJapaneseFields && (
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {record.description_ja || '-'}
                      </Typography>
                    </TableCell>
                  )}
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(record.created_at)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
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
                      onClick={() => {
                        setSelectedRecord(record);
                        setDeleteDialogOpen(true);
                      }}
                      title="削除"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 作成ダイアログ */}
      <Dialog
        open={createDialogOpen}
        onClose={() => !submitting && setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>新規作成</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label={showJapaneseFields ? "名前 (English)" : "名前"}
              required
              fullWidth
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              disabled={submitting}
              autoFocus
              placeholder="e.g., High Angle"
            />
            {showJapaneseFields && (
              <TextField
                label="名前 (日本語)"
                fullWidth
                value={formNameJa}
                onChange={(e) => setFormNameJa(e.target.value)}
                disabled={submitting}
                placeholder="例：ハイアングル"
              />
            )}
            <TextField
              label={showJapaneseFields ? "説明 (English)" : "説明"}
              fullWidth
              multiline
              rows={3}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              disabled={submitting}
              placeholder="e.g., Looks down on the subject..."
            />
            {showJapaneseFields && (
              <TextField
                label="説明 (日本語)"
                fullWidth
                multiline
                rows={3}
                value={formDescriptionJa}
                onChange={(e) => setFormDescriptionJa(e.target.value)}
                disabled={submitting}
                placeholder="例：上から見下ろす。被写体を弱く、小さく見せる効果。"
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={submitting}>
            キャンセル
          </Button>
          <Button onClick={handleCreate} variant="contained" disabled={submitting}>
            {submitting ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
            作成
          </Button>
        </DialogActions>
      </Dialog>

      {/* 編集ダイアログ */}
      <Dialog
        open={editDialogOpen}
        onClose={() => !submitting && setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>編集</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label={showJapaneseFields ? "名前 (English)" : "名前"}
              required
              fullWidth
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              disabled={submitting}
              autoFocus
              placeholder="e.g., High Angle"
            />
            {showJapaneseFields && (
              <TextField
                label="名前 (日本語)"
                fullWidth
                value={formNameJa}
                onChange={(e) => setFormNameJa(e.target.value)}
                disabled={submitting}
                placeholder="例：ハイアングル"
              />
            )}
            <TextField
              label={showJapaneseFields ? "説明 (English)" : "説明"}
              fullWidth
              multiline
              rows={3}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              disabled={submitting}
              placeholder="e.g., Looks down on the subject..."
            />
            {showJapaneseFields && (
              <TextField
                label="説明 (日本語)"
                fullWidth
                multiline
                rows={3}
                value={formDescriptionJa}
                onChange={(e) => setFormDescriptionJa(e.target.value)}
                disabled={submitting}
                placeholder="例：上から見下ろす。被写体を弱く、小さく見せる効果。"
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} disabled={submitting}>
            キャンセル
          </Button>
          <Button onClick={handleUpdate} variant="contained" disabled={submitting}>
            {submitting ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
            更新
          </Button>
        </DialogActions>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>削除しますか？</DialogTitle>
        <DialogContent>
          <Typography>
            この操作は取り消せません。「{selectedRecord?.name}」を削除してもよろしいですか？
          </Typography>
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
