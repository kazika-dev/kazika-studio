'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ImageIcon from '@mui/icons-material/Image';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import SaveIcon from '@mui/icons-material/Save';
import WorkflowStepList from './WorkflowStepList';

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

interface Workflow {
  id: number;
  name: string;
  description: string;
}

export default function StudioBoard({ board, index, onUpdate, onDelete }: StudioBoardProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);
  const [stepsExpanded, setStepsExpanded] = useState(false);

  // ワークフロー関連
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(board.workflow_id);
  const [executing, setExecuting] = useState(false);

  // 編集フォーム
  const [editTitle, setEditTitle] = useState(board.title);
  const [editDescription, setEditDescription] = useState(board.description);
  const [editPrompt, setEditPrompt] = useState(board.prompt_text);
  const [editDuration, setEditDuration] = useState(board.duration_seconds?.toString() || '5');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ワークフロー一覧を読み込む
  const loadWorkflows = async () => {
    try {
      setLoadingWorkflows(true);
      const response = await fetch('/api/workflows');
      const data = await response.json();

      if (data.success) {
        setWorkflows(data.workflows);
      }
    } catch (err) {
      console.error('Failed to load workflows:', err);
    } finally {
      setLoadingWorkflows(false);
    }
  };

  // ワークフローを選択
  const handleSelectWorkflow = async (workflowId: number) => {
    try {
      const response = await fetch(`/api/studios/boards/${board.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow_id: workflowId }),
      });

      const data = await response.json();

      if (data.success) {
        setSelectedWorkflowId(workflowId);
        onUpdate(data.board);
        setWorkflowDialogOpen(false);
      } else {
        alert(data.error || 'ワークフローの選択に失敗しました');
      }
    } catch (err: any) {
      alert('ワークフローの選択中にエラーが発生しました');
      console.error(err);
    }
  };

  // ワークフローを実行
  const handleExecuteWorkflow = async () => {
    if (!board.workflow_id) {
      alert('ワークフローが選択されていません');
      return;
    }

    try {
      setExecuting(true);

      // ボードのステータスを処理中に更新
      await fetch(`/api/studios/boards/${board.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'processing' }),
      });

      // ワークフローを実行（プロンプトを入力として渡す）
      const response = await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: board.workflow_id,
          inputs: board.prompt_text ? { prompt: board.prompt_text } : {},
        }),
      });

      const data = await response.json();

      if (data.success) {
        // 実行結果からoutputsを抽出してボードを更新
        const outputs = data.outputs;
        const updates: any = { status: 'completed' };

        // 各ノードの出力を確認
        Object.values(outputs).forEach((output: any) => {
          if (output.nodeType === 'nanobana' || output.nodeType === 'gemini') {
            // 画像出力
            if (output.output?.imageData) {
              // TODO: 画像をGCP Storageに保存してimage_output_idを設定
            }
          } else if (output.nodeType === 'higgsfield') {
            // 動画出力
            if (output.output?.videoUrl) {
              updates.custom_video_url = output.output.videoUrl;
            }
          } else if (output.nodeType === 'elevenlabs') {
            // 音声出力
            if (output.output?.audioData) {
              // TODO: 音声をGCP Storageに保存してaudio_output_idを設定
            }
          }
        });

        // ボードを更新
        const updateResponse = await fetch(`/api/studios/boards/${board.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        const updateData = await updateResponse.json();

        if (updateData.success) {
          onUpdate(updateData.board);
          alert('ワークフローの実行が完了しました');
        }
      } else {
        // エラー時
        await fetch(`/api/studios/boards/${board.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'error',
            error_message: data.error || 'ワークフローの実行に失敗しました',
          }),
        });
        alert(data.error || 'ワークフローの実行に失敗しました');
      }
    } catch (err: any) {
      await fetch(`/api/studios/boards/${board.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'error',
          error_message: err.message || 'エラーが発生しました',
        }),
      });
      alert('ワークフローの実行中にエラーが発生しました');
      console.error(err);
    } finally {
      setExecuting(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const response = await fetch(`/api/studios/boards/${board.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          prompt_text: editPrompt,
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

            {/* プロンプト */}
            {board.prompt_text && (
              <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  プロンプト
                </Typography>
                <Typography variant="body2">{board.prompt_text}</Typography>
              </Box>
            )}

            {/* コンテンツプレビュー */}
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              {/* 画像 */}
              {(board.image_output_id || board.custom_image_url) && (
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
                    <ImageIcon fontSize="small" color="action" />
                    <Typography variant="caption" color="text.secondary">
                      画像
                    </Typography>
                  </Stack>
                  <Card variant="outlined" sx={{ bgcolor: 'grey.100', height: 120 }}>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      <ImageIcon color="action" />
                    </CardContent>
                  </Card>
                </Box>
              )}

              {/* 動画 */}
              {(board.video_output_id || board.custom_video_url) && (
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
                    <VideoLibraryIcon fontSize="small" color="action" />
                    <Typography variant="caption" color="text.secondary">
                      動画
                    </Typography>
                  </Stack>
                  <Card variant="outlined" sx={{ bgcolor: 'grey.100', height: 120 }}>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      <VideoLibraryIcon color="action" />
                    </CardContent>
                  </Card>
                </Box>
              )}

              {/* 音声 */}
              {(board.audio_output_id || board.custom_audio_url) && (
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
                    <AudiotrackIcon fontSize="small" color="action" />
                    <Typography variant="caption" color="text.secondary">
                      音声
                    </Typography>
                  </Stack>
                  <Card variant="outlined" sx={{ bgcolor: 'grey.100', height: 120 }}>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      <AudiotrackIcon color="action" />
                    </CardContent>
                  </Card>
                </Box>
              )}
            </Stack>

            {/* アクション */}
            <Stack direction="row" spacing={2} alignItems="center">
              {board.workflow_id ? (
                <Button
                  variant="contained"
                  startIcon={executing ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                  size="small"
                  onClick={handleExecuteWorkflow}
                  disabled={executing || board.status === 'processing'}
                >
                  {executing || board.status === 'processing' ? '実行中...' : 'ワークフロー実行'}
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    loadWorkflows();
                    setWorkflowDialogOpen(true);
                  }}
                >
                  ワークフローを選択
                </Button>
              )}
              {board.workflow_id && (
                <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    loadWorkflows();
                    setWorkflowDialogOpen(true);
                  }}
                >
                  変更
                </Button>
              )}
              {board.duration_seconds && (
                <Chip
                  label={`${board.duration_seconds}秒`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Stack>

            {/* エラーメッセージ */}
            {board.error_message && (
              <Box sx={{ mt: 2, p: 1.5, bgcolor: 'error.light', borderRadius: 1 }}>
                <Typography variant="body2" color="error.dark">
                  {board.error_message}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* ワークフローステップセクション */}
        <Accordion
          expanded={stepsExpanded}
          onChange={(_e, isExpanded) => setStepsExpanded(isExpanded)}
          sx={{ boxShadow: 'none', '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" fontWeight={600}>
              ワークフローチェーン
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <WorkflowStepList
              boardId={board.id}
              onExecute={() => {
                // ボードを再読み込みして最新の状態を取得
                fetch(`/api/studios/boards/${board.id}`)
                  .then((res) => res.json())
                  .then((data) => {
                    if (data.success) {
                      onUpdate(data.board);
                    }
                  });
              }}
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
            label="プロンプト"
            fullWidth
            multiline
            rows={4}
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
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

      {/* ワークフロー選択ダイアログ */}
      <Dialog
        open={workflowDialogOpen}
        onClose={() => !loadingWorkflows && setWorkflowDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>ワークフローを選択</DialogTitle>
        <DialogContent>
          {loadingWorkflows ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }}>読み込み中...</Typography>
            </Box>
          ) : workflows.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                ワークフローがありません
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                ワークフローページから作成してください
              </Typography>
            </Box>
          ) : (
            <List sx={{ pt: 0 }}>
              {workflows.map((workflow) => (
                <ListItem key={workflow.id} disablePadding>
                  <ListItemButton
                    selected={workflow.id === selectedWorkflowId}
                    onClick={() => handleSelectWorkflow(workflow.id)}
                  >
                    <ListItemText
                      primary={workflow.name}
                      secondary={workflow.description}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setWorkflowDialogOpen(false)}>
            キャンセル
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
