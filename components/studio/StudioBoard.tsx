'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Typography,
  IconButton,
  Button,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import WorkflowStepList from './WorkflowStepList';
import AccountTreeIcon from '@mui/icons-material/AccountTree';

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

interface StudioBoardProps {
  board: Board;
  index: number;
  onUpdate: (board: Board) => void;
  onDelete: (boardId: number) => void;
}

export default function StudioBoard({ board, index, onUpdate, onDelete }: StudioBoardProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const [stepCount, setStepCount] = useState(0);

  // ステップ数を取得
  useEffect(() => {
    const fetchStepCount = async () => {
      try {
        const response = await fetch(`/api/studios/boards/${board.id}/steps`);
        const data = await response.json();
        if (data.success) {
          const count = data.steps.length;
          setStepCount(count);
          // ステップがある場合、デフォルトで開く
          if (count > 0) {
            setStepsExpanded(true);
          }
        }
      } catch (err) {
        console.error('Failed to fetch step count:', err);
      }
    };

    fetchStepCount();
  }, [board.id]);

  // 編集フォーム
  const [editTitle, setEditTitle] = useState(board.title);
  const [editDescription, setEditDescription] = useState(board.description);
  const [editDuration, setEditDuration] = useState(board.duration_seconds?.toString() || '5');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);

      const response = await fetch(`/api/studios/boards/${board.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          duration_seconds: parseFloat(editDuration) || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        onUpdate(data.board);
        setEditDialogOpen(false);
      } else {
        alert(data.error || 'ボードの更新に失敗しました');
      }
    } catch (err: any) {
      alert('ボードの更新中にエラーが発生しました');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);

      const response = await fetch(`/api/studios/boards/${board.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        onDelete(board.id);
        setDeleteDialogOpen(false);
      } else {
        alert(data.error || 'ボードの削除に失敗しました');
      }
    } catch (err: any) {
      alert('ボードの削除中にエラーが発生しました');
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const getStatusColor = () => {
    switch (board.status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'info';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = () => {
    switch (board.status) {
      case 'completed':
        return '完了';
      case 'processing':
        return '処理中';
      case 'error':
        return 'エラー';
      default:
        return '下書き';
    }
  };

  return (
    <>
      <Card variant="outlined">
        <Box sx={{ display: 'flex', gap: 2, p: 2 }}>
          {/* シーケンス番号 */}
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '1.25rem',
              flexShrink: 0,
            }}
          >
            {index + 1}
          </Box>

          {/* メインコンテンツ */}
          <Box sx={{ flex: 1 }}>
            {/* ヘッダー */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  {board.title || `シーン ${index + 1}`}
                </Typography>
                {board.description && (
                  <Typography variant="body2" color="text.secondary">
                    {board.description}
                  </Typography>
                )}
              </Box>
              <Stack direction="row" spacing={1}>
                <Chip label={getStatusLabel()} color={getStatusColor()} size="small" />
                <IconButton size="small" onClick={() => setEditDialogOpen(true)}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => setDeleteDialogOpen(true)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Box>

            {/* エラーメッセージ */}
            {board.error_message && (
              <Box sx={{ mt: 2, p: 1.5, bgcolor: 'error.light', borderRadius: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <Typography variant="body2" color="error.dark" sx={{ flex: 1 }}>
                  {board.error_message}
                </Typography>
                <IconButton
                  size="small"
                  onClick={async () => {
                    // エラーメッセージをクリア
                    try {
                      const response = await fetch(`/api/studios/boards/${board.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          error_message: null,
                          status: 'draft',
                        }),
                      });

                      const data = await response.json();
                      if (data.success) {
                        onUpdate(data.board);
                      }
                    } catch (err) {
                      console.error('Failed to clear error:', err);
                    }
                  }}
                  sx={{ ml: 1 }}
                  title="エラーを消去"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            )}
          </Box>
        </Box>

        {/* ワークフローステップセクション */}
        <Accordion
          expanded={stepsExpanded}
          onChange={(_e, isExpanded) => setStepsExpanded(isExpanded)}
          sx={{
            boxShadow: 'none',
            '&:before': { display: 'none' },
            bgcolor: stepCount > 0 ? 'action.hover' : 'transparent',
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
              <Badge badgeContent={stepCount} color="primary">
                <AccountTreeIcon color="action" />
              </Badge>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  ワークフローチェーン
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {stepCount === 0
                    ? '複数のワークフローを連鎖実行'
                    : `${stepCount}個のステップを連鎖実行`}
                </Typography>
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <WorkflowStepList
              boardId={board.id}
              onStepCountChange={(count) => setStepCount(count)}
            />
          </AccordionDetails>
        </Accordion>
      </Card>

      {/* 編集ダイアログ */}
      <Dialog
        open={editDialogOpen}
        onClose={() => !saving && setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>シーンを編集</DialogTitle>
        <DialogContent>
          <TextField
            label="タイトル"
            fullWidth
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            sx={{ mt: 2, mb: 2 }}
          />
          <TextField
            label="説明"
            fullWidth
            multiline
            rows={2}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            label="長さ（秒）"
            type="number"
            fullWidth
            value={editDuration}
            onChange={(e) => setEditDuration(e.target.value)}
            slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditDialogOpen(false)} disabled={saving}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <CircularProgress size={24} /> : '保存'}
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
        <DialogTitle>シーンを削除</DialogTitle>
        <DialogContent>
          <Typography>
            「{board.title || `シーン ${index + 1}`}」を削除してもよろしいですか？
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            この操作は取り消せません。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? <CircularProgress size={24} /> : '削除'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
