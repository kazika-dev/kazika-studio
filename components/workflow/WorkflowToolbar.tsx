'use client';

import { useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Snackbar,
  Alert,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

interface WorkflowToolbarProps {
  onSave: (name: string, description: string) => Promise<void>;
  onLoad: (workflowId: number) => Promise<void>;
  onNew: () => void;
  currentWorkflowId?: number;
}

interface Workflow {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export default function WorkflowToolbar({ onSave, onLoad, onNew, currentWorkflowId }: WorkflowToolbarProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const handleSaveClick = () => {
    setSaveDialogOpen(true);
  };

  const handleSave = async () => {
    if (!workflowName.trim()) {
      setSnackbar({ open: true, message: 'ワークフロー名を入力してください', severity: 'error' });
      return;
    }

    try {
      await onSave(workflowName, workflowDescription);
      setSaveDialogOpen(false);
      setWorkflowName('');
      setWorkflowDescription('');
      setSnackbar({ open: true, message: '保存しました', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: '保存に失敗しました', severity: 'error' });
    }
  };

  const handleLoadClick = async () => {
    try {
      const response = await fetch('/api/workflows');
      const data = await response.json();
      if (data.success) {
        setWorkflows(data.workflows);
        setLoadDialogOpen(true);
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'ワークフロー一覧の取得に失敗しました', severity: 'error' });
    }
  };

  const handleLoad = async (workflowId: number) => {
    try {
      await onLoad(workflowId);
      setLoadDialogOpen(false);
      setSnackbar({ open: true, message: '読み込みました', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: '読み込みに失敗しました', severity: 'error' });
    }
  };

  const handleDelete = async (workflowId: number, event: React.MouseEvent) => {
    event.stopPropagation();

    if (!confirm('このワークフローを削除しますか？')) {
      return;
    }

    try {
      const response = await fetch(`/api/workflows?id=${workflowId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setWorkflows(workflows.filter(w => w.id !== workflowId));
        setSnackbar({ open: true, message: '削除しました', severity: 'success' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: '削除に失敗しました', severity: 'error' });
    }
  };

  return (
    <>
      <Paper
        elevation={3}
        sx={{
          position: 'absolute',
          top: 24,
          right: 24,
          zIndex: 10,
          p: 2,
          bgcolor: 'background.paper',
          borderRadius: 2,
        }}
      >
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={onNew}
            sx={{ textTransform: 'none' }}
          >
            新規作成
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSaveClick}
            sx={{ textTransform: 'none' }}
          >
            {currentWorkflowId ? '上書き保存' : '保存'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<FolderOpenIcon />}
            onClick={handleLoadClick}
            sx={{ textTransform: 'none' }}
          >
            読み込み
          </Button>
        </Stack>
      </Paper>

      {/* 保存ダイアログ */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>ワークフローを保存</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="ワークフロー名"
              fullWidth
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              autoFocus
            />
            <TextField
              label="説明（オプション）"
              fullWidth
              multiline
              rows={3}
              value={workflowDescription}
              onChange={(e) => setWorkflowDescription(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleSave} variant="contained">保存</Button>
        </DialogActions>
      </Dialog>

      {/* 読み込みダイアログ */}
      <Dialog open={loadDialogOpen} onClose={() => setLoadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            ワークフローを読み込み
            <IconButton onClick={() => setLoadDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <List>
            {workflows.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                保存されたワークフローがありません
              </Typography>
            ) : (
              workflows.map((workflow) => (
                <ListItem
                  key={workflow.id}
                  disablePadding
                  secondaryAction={
                    <Stack direction="row" spacing={1}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/form?id=${workflow.id}`, '_blank');
                        }}
                        color="primary"
                        title="フォームで実行"
                      >
                        <PlayArrowIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => handleDelete(workflow.id, e)}
                        color="error"
                        title="削除"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                  }
                >
                  <ListItemButton onClick={() => handleLoad(workflow.id)}>
                    <ListItemText
                      primary={workflow.name}
                      secondary={
                        <>
                          {workflow.description && <>{workflow.description}<br /></>}
                          更新: {new Date(workflow.updated_at).toLocaleString('ja-JP')}
                        </>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))
            )}
          </List>
        </DialogContent>
      </Dialog>

      {/* スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
