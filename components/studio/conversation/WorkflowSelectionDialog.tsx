'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Alert,
  Box,
  Typography,
  Divider,
} from '@mui/material';

interface Workflow {
  id: number;
  name: string;
  description: string;
}

interface WorkflowSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (workflowIds: number[]) => void;
}

export default function WorkflowSelectionDialog({
  open,
  onClose,
  onSelect,
}: WorkflowSelectionDialogProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadWorkflows();
    }
  }, [open]);

  const loadWorkflows = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/workflows');
      const result = await response.json();

      if (result.success && result.workflows) {
        // ElevenLabs TTSワークフローを除外
        const filteredWorkflows = result.workflows.filter(
          (w: Workflow) => w.name !== 'ElevenLabs TTS'
        );
        setWorkflows(filteredWorkflows);
      } else {
        setError('ワークフローの読み込みに失敗しました');
      }
    } catch (err) {
      console.error('Failed to load workflows:', err);
      setError('ワークフローの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    onSelect(selectedWorkflowIds);
    onClose();
  };

  const handleCancel = () => {
    setSelectedWorkflowIds([]);
    onClose();
  };

  const handleToggleWorkflow = (workflowId: number) => {
    setSelectedWorkflowIds((prev) =>
      prev.includes(workflowId)
        ? prev.filter((id) => id !== workflowId)
        : [...prev, workflowId]
    );
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="sm" fullWidth>
      <DialogTitle>ワークフローを選択</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          各ボードに追加するワークフローを選択してください（複数選択可）。
          <br />
          選択しない場合、ワークフローは追加されません。
        </Typography>
        {selectedWorkflowIds.length > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {selectedWorkflowIds.length} 個のワークフローを選択中
          </Alert>
        )}
        <Divider sx={{ mb: 2 }} />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : workflows.length === 0 ? (
          <Alert severity="info">
            利用可能なワークフローがありません。
            <br />
            先にワークフローを作成してください。
          </Alert>
        ) : (
          <Box>
            {workflows.map((workflow) => (
              <FormControlLabel
                key={workflow.id}
                control={
                  <Checkbox
                    checked={selectedWorkflowIds.includes(workflow.id)}
                    onChange={() => handleToggleWorkflow(workflow.id)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1" fontWeight={600}>
                      {workflow.name}
                    </Typography>
                    {workflow.description && (
                      <Typography variant="caption" color="text.secondary">
                        {workflow.description}
                      </Typography>
                    )}
                  </Box>
                }
              />
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>キャンセル</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={loading}
        >
          確認
        </Button>
      </DialogActions>
    </Dialog>
  );
}
