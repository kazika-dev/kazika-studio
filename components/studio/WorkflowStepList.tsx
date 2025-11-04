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
  metadata?: any;
  created_at: string;
  updated_at: string;
}

interface WorkflowStepListProps {
  boardId: number;
  onStepCountChange?: (count: number) => void;
}

export default function WorkflowStepList({ boardId, onStepCountChange }: WorkflowStepListProps) {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);

  // ステップ一覧を読み込む
  // デフォルトでは軽量版（詳細なし）を取得
  const loadSteps = async (includeDetails: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      const url = `/api/studios/boards/${boardId}/steps${includeDetails ? '?details=true' : ''}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setSteps(data.steps);
        // ステップ数の変更を通知
        if (onStepCountChange) {
          onStepCountChange(data.steps.length);
        }
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

  // ステップを編集
  const handleEditStep = (step: WorkflowStep) => {
    setEditingStep(step);
    setEditDialogOpen(true);
  };

  // ステップを更新
  const handleUpdateStep = async (stepId: number, stepData: {
    workflow_id: number;
    input_config: any;
  }) => {
    try {
      const response = await fetch(`/api/studios/steps/${stepId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stepData),
      });

      const data = await response.json();

      if (data.success) {
        await loadSteps();
        setEditDialogOpen(false);
        setEditingStep(null);
      } else {
        alert(data.error || 'ステップの更新に失敗しました');
      }
    } catch (err: any) {
      console.error('Failed to update step:', err);
      alert('ステップの更新中にエラーが発生しました');
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

  // ステップ状態を更新（実行時などに使用）
  const handleStepUpdate = (updatedStep: WorkflowStep) => {
    setSteps((prevSteps) =>
      prevSteps.map((step) =>
        step.id === updatedStep.id ? updatedStep : step
      )
    );
  };

  // 個別ステップを実行
  const handleExecuteStep = async (stepId: number) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    if (!confirm(`ステップ ${step.step_order + 1}: ${step.workflow_name || 'ワークフロー'} を実行しますか？`)) {
      return;
    }

    try {
      // ステップのステータスを実行中に更新
      handleStepUpdate({ ...step, execution_status: 'running' });

      const response = await fetch(`/api/studios/steps/${stepId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      // レスポンスのステータスを確認
      if (!response.ok) {
        console.error('Execute step API error:', {
          status: response.status,
          statusText: response.statusText,
        });

        // レスポンスのテキストを取得してログ出力
        const responseText = await response.text();
        console.error('Response text:', responseText);

        // JSONとしてパースできるか試す
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Failed to parse error response as JSON');
          errorData = { error: `サーバーエラー (${response.status})`, details: responseText };
        }

        // ステップを再読み込みしてエラー状態を取得
        const stepResponse = await fetch(`/api/studios/steps/${stepId}`);
        const stepData = await stepResponse.json();
        if (stepData.success && stepData.step) {
          handleStepUpdate(stepData.step);
        }

        const errorMessage = errorData.error || 'ステップの実行に失敗しました';
        const errorDetails = errorData.details ? `\n詳細: ${errorData.details}` : '';
        alert(`${errorMessage}${errorDetails}\n\nエラーの詳細はステップカードを展開して確認してください。`);
        return;
      }

      // 正常なレスポンスの場合
      const responseText = await response.text();
      console.log('Execute step response text:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse success response as JSON:', parseError);
        console.error('Response text:', responseText);

        // パースエラーでもステップを再読み込み
        const stepResponse = await fetch(`/api/studios/steps/${stepId}`);
        const stepData = await stepResponse.json();
        if (stepData.success && stepData.step) {
          handleStepUpdate(stepData.step);
        }

        alert('レスポンスの解析に失敗しました。ステップの状態を確認してください。');
        return;
      }

      if (data.success && data.step) {
        // 実行APIから返された更新されたステップのみを更新
        handleStepUpdate(data.step);
      } else {
        // エラー時は該当ステップのみ再読み込み
        const stepResponse = await fetch(`/api/studios/steps/${stepId}`);
        const stepData = await stepResponse.json();
        if (stepData.success && stepData.step) {
          handleStepUpdate(stepData.step);
        }
        // 詳細なエラー情報を表示
        const errorMessage = data.error || 'ステップの実行に失敗しました';
        const errorDetails = data.details ? `\n詳細: ${data.details}` : '';
        alert(`${errorMessage}${errorDetails}\n\nエラーの詳細はステップカードを展開して確認してください。`);
      }
    } catch (err: any) {
      console.error('Failed to execute step:', err);
      // エラー時も該当ステップのみ再読み込み
      try {
        const stepResponse = await fetch(`/api/studios/steps/${stepId}`);
        const stepData = await stepResponse.json();
        if (stepData.success && stepData.step) {
          handleStepUpdate(stepData.step);
        }
      } catch (reloadErr) {
        console.error('Failed to reload step:', reloadErr);
      }
      alert(`ステップの実行中にエラーが発生しました\n\nエラー: ${err.message || '不明なエラー'}`);
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

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          ワークフローステップ
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            size="small"
            onClick={() => setAddDialogOpen(true)}
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
                onUpdate={handleStepUpdate}
                onDelete={handleDeleteStep}
                onEdit={handleEditStep}
                onExecute={handleExecuteStep}
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

      {/* ステップ編集ダイアログ */}
      <AddWorkflowStepDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditingStep(null);
        }}
        onAdd={handleAddStep}
        onUpdate={handleUpdateStep}
        hasPreviousSteps={steps.length > 0}
        editStep={editingStep}
      />
    </Box>
  );
}
