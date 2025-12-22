'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Fab,
  Tooltip,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import type {
  PromptQueueWithImages,
  PromptQueueStatus,
  CreatePromptQueueRequest,
  UpdatePromptQueueRequest,
} from '@/types/prompt-queue';
import PromptQueueCard from '@/components/prompt-queue/PromptQueueCard';
import PromptQueueDialog from '@/components/prompt-queue/PromptQueueDialog';

export default function PromptQueuePage() {
  const [queues, setQueues] = useState<PromptQueueWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PromptQueueStatus>('pending');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editQueue, setEditQueue] = useState<PromptQueueWithImages | null>(null);
  const [executing, setExecuting] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const fetchQueues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('status', statusFilter);
      params.set('limit', '100');

      const response = await fetch(`/api/prompt-queue?${params.toString()}`);
      if (!response.ok) {
        throw new Error('キューの取得に失敗しました');
      }
      const data = await response.json();
      setQueues(data.queues || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchQueues();
  }, [fetchQueues]);

  const handleCreateQueue = async (data: CreatePromptQueueRequest) => {
    const response = await fetch('/api/prompt-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('キューの作成に失敗しました');
    }
    await fetchQueues();
    setSnackbar({ open: true, message: 'キューを作成しました', severity: 'success' });
  };

  const handleUpdateQueue = async (data: UpdatePromptQueueRequest) => {
    if (!editQueue) return;
    const response = await fetch(`/api/prompt-queue/${editQueue.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('キューの更新に失敗しました');
    }
    await fetchQueues();
    setSnackbar({ open: true, message: 'キューを更新しました', severity: 'success' });
  };

  const handleSave = async (data: CreatePromptQueueRequest | UpdatePromptQueueRequest) => {
    if (editQueue) {
      await handleUpdateQueue(data as UpdatePromptQueueRequest);
    } else {
      await handleCreateQueue(data as CreatePromptQueueRequest);
    }
  };

  const handleEdit = (queue: PromptQueueWithImages) => {
    setEditQueue(queue);
    setDialogOpen(true);
  };

  const handleDelete = async (queue: PromptQueueWithImages) => {
    if (!confirm(`キュー「${queue.name || queue.prompt.slice(0, 20)}...」を削除しますか？`)) {
      return;
    }
    try {
      const response = await fetch(`/api/prompt-queue/${queue.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('キューの削除に失敗しました');
      }
      await fetchQueues();
      setSnackbar({ open: true, message: 'キューを削除しました', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handleExecute = async (queue: PromptQueueWithImages) => {
    try {
      const response = await fetch(`/api/prompt-queue/${queue.id}/execute`, {
        method: 'POST',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '実行に失敗しました');
      }
      await fetchQueues();
      setSnackbar({ open: true, message: '実行が完了しました', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handleExecuteAll = async () => {
    const pendingQueues = queues.filter((q) => q.status === 'pending');
    if (pendingQueues.length === 0) {
      setSnackbar({ open: true, message: '実行待ちのキューがありません', severity: 'error' });
      return;
    }

    if (!confirm(`${pendingQueues.length}件のキューを実行しますか？`)) {
      return;
    }

    setExecuting(true);
    try {
      const response = await fetch('/api/prompt-queue/execute-all', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('一括実行に失敗しました');
      }
      const result = await response.json();
      await fetchQueues();
      setSnackbar({
        open: true,
        message: `${result.executed}件成功、${result.failed}件失敗`,
        severity: result.failed > 0 ? 'error' : 'success',
      });
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    } finally {
      setExecuting(false);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditQueue(null);
  };

  const pendingCount = queues.filter((q) => q.status === 'pending').length;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          プロンプトキュー
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchQueues}
            disabled={loading}
          >
            更新
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={executing ? <CircularProgress size={20} color="inherit" /> : <PlayIcon />}
            onClick={handleExecuteAll}
            disabled={executing || pendingCount === 0}
          >
            全て実行 ({pendingCount})
          </Button>
        </Box>
      </Box>

      {/* ステータスフィルター */}
      <Tabs
        value={statusFilter}
        onChange={(_, value) => setStatusFilter(value)}
        sx={{ mb: 3 }}
      >
        <Tab value="pending" label="待機中" />
        <Tab value="processing" label="実行中" />
        <Tab value="completed" label="完了" />
        <Tab value="failed" label="失敗" />
        <Tab value="cancelled" label="キャンセル" />
      </Tabs>

      {/* エラー表示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* キュー一覧 */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : queues.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography color="text.secondary" gutterBottom>
            キューがありません
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
            新しいキューを作成
          </Button>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {queues.map((queue) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={queue.id}>
              <PromptQueueCard
                queue={queue}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onExecute={handleExecute}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* 新規作成FAB */}
      <Tooltip title="新しいキューを作成">
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 24, right: 24 }}
          onClick={() => setDialogOpen(true)}
        >
          <AddIcon />
        </Fab>
      </Tooltip>

      {/* 作成/編集ダイアログ */}
      <PromptQueueDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSave={handleSave}
        editQueue={editQueue}
      />

      {/* スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
