'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Stack,
  Alert,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import WorkflowStepCard from './WorkflowStepCard';
import AddWorkflowStepDialog from './AddWorkflowStepDialog';

interface WorkflowStep {
  id: number;
  board_id: number;
  workflow_id: number;
  workflow_name?: string;
  workflow_description?: string;
  step_order: number;
  input_config: any;
  execution_status: 'pending' | 'running' | 'completed' | 'failed';
  output_data: any;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkflowStepListProps {
  boardId: number;
  onExecute?: () => void;
}

export default function WorkflowStepList({ boardId, onExecute }: WorkflowStepListProps) {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [executing, setExecuting] = useState(false);

  // ステップ一覧を読み込む
  const loadSteps = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/studios/boards/${boardId}/steps`);
      const data = await response.json();

      if (data.success) {
        setSteps(data.steps);
      } else {
        setError(data.error || 'ステップの読み込みに失敗しました');
      }
    } catch (err: any) {
      console.error('Failed to load steps:', err);
      setError('ステップの読み込み中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSteps();
  }, [boardId]);

  // ステップを追加
  const handleAddStep = async (stepData: {
    workflow_id: number;
    input_config: any;
  }) => {
    try {
      const response = await fetch(`/api/studios/boards/${boardId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...stepData,
          step_order: steps.length, // 最後に追加
        }),
      });

      const data = await response.json();

      if (data.success) {
        await loadSteps();
        setAddDialogOpen(false);
      } else {
        alert(data.error || 'ステップの追加に失敗しました');
      }
    } catch (err: any) {
      console.error('Failed to add step:', err);
      alert('ステップの追加中にエラーが発生しました');
    }
  };

  // ステップを削除
  const handleDeleteStep = async (stepId: number) => {
    if (!confirm('このステップを削除してもよろしいですか？')) {
      return;
    }

    try {
      const response = await fetch(`/api/studios/steps/${stepId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        await loadSteps();
      } else {
        alert(data.error || 'ステップの削除に失敗しました');
      }
    } catch (err: any) {
      console.error('Failed to delete step:', err);
      alert('ステップの削除中にエラーが発生しました');
    }
  };

  // ステップを更新
  const handleUpdateStep = (updatedStep: WorkflowStep) => {
    setSteps((prevSteps) =>
      prevSteps.map((step) =>
        step.id === updatedStep.id ? updatedStep : step
      )
    );
  };

  // 全ステップを実行
  const handleExecuteAll = async () => {
    if (steps.length === 0) {
      alert('実行するステップがありません');
      return;
    }

    if (!confirm('全てのワークフローステップを順次実行しますか？')) {
      return;
    }

    try {
      setExecuting(true);

      const response = await fetch(`/api/studios/boards/${boardId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (data.success) {
        // ステップを再読み込み
        await loadSteps();
        alert('全てのステップが正常に完了しました');
        if (onExecute) {
          onExecute();
        }
      } else {
        alert(data.error || '実行に失敗しました');
        // エラーでも再読み込みして状態を更新
        await loadSteps();
      }
    } catch (err: any) {
      console.error('Failed to execute board:', err);
      alert('実行中にエラーが発生しました');
      await loadSteps();
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>読み込み中...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  const hasRunningSteps = steps.some((step) => step.execution_status === 'running');
  const allPending = steps.every((step) => step.execution_status === 'pending');

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          ワークフローステップ
        </Typography>
        <Stack direction="row" spacing={1}>
          {steps.length > 0 && (
            <Button
              variant="contained"
              startIcon={executing || hasRunningSteps ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
              size="small"
              onClick={handleExecuteAll}
              disabled={executing || hasRunningSteps}
            >
              {executing || hasRunningSteps ? '実行中...' : '全て実行'}
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            size="small"
            onClick={() => setAddDialogOpen(true)}
            disabled={executing || hasRunningSteps}
          >
            ステップを追加
          </Button>
        </Stack>
      </Box>

      {/* ステップ一覧 */}
      {steps.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            px: 2,
            border: '2px dashed',
            borderColor: 'grey.300',
            borderRadius: 2,
            bgcolor: 'grey.50',
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            ワークフローステップがありません
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            ステップを追加して、複数のワークフローを連鎖実行できます
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
          >
            最初のステップを追加
          </Button>
        </Box>
      ) : (
        <Stack spacing={2}>
          {steps.map((step) => (
            <Box key={step.id} sx={{ position: 'relative' }}>
              <WorkflowStepCard
                step={step}
                onUpdate={handleUpdateStep}
                onDelete={handleDeleteStep}
              />
              {/* 矢印 */}
              {step.step_order < steps.length - 1 && (
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 1,
                    color: 'text.secondary',
                  }}
                >
                  ↓
                </Box>
              )}
            </Box>
          ))}
        </Stack>
      )}

      {/* ステップ追加ダイアログ */}
      <AddWorkflowStepDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={handleAddStep}
        hasPreviousSteps={steps.length > 0}
      />
    </Box>
  );
}
