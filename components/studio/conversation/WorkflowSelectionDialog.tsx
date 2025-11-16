'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
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
  onSelect: (workflowId: number | null) => void;
}

export default function WorkflowSelectionDialog({
  open,
  onClose,
  onSelect,
}: WorkflowSelectionDialogProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);
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
    onSelect(selectedWorkflowId);
    onClose();
  };

  const handleCancel = () => {
    setSelectedWorkflowId(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="sm" fullWidth>
      <DialogTitle>ワークフローを選択</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          各ボードに追加するワークフローを選択してください。
          <br />
          選択しない場合、ワークフローは追加されません。
        </Typography>
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
          <RadioGroup
            value={selectedWorkflowId?.toString() || ''}
            onChange={(e) => setSelectedWorkflowId(Number(e.target.value))}
          >
            <FormControlLabel
              value=""
              control={<Radio />}
              label="ワークフローを追加しない"
            />
            {workflows.map((workflow) => (
              <FormControlLabel
                key={workflow.id}
                value={workflow.id.toString()}
                control={<Radio />}
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
          </RadioGroup>
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
