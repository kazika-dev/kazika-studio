'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  InputLabel,
  Typography,
  Box,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

interface Workflow {
  id: number;
  name: string;
  description: string;
}

interface AddWorkflowStepDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (stepData: { workflow_id: number; input_config: any }) => void;
  hasPreviousSteps: boolean;
}

export default function AddWorkflowStepDialog({
  open,
  onClose,
  onAdd,
  hasPreviousSteps,
}: AddWorkflowStepDialogProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);

  // 入力設定
  const [usePrompt, setUsePrompt] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [usePreviousImage, setUsePreviousImage] = useState(false);
  const [usePreviousVideo, setUsePreviousVideo] = useState(false);
  const [usePreviousAudio, setUsePreviousAudio] = useState(false);
  const [usePreviousText, setUsePreviousText] = useState(false);
  const [customInputs, setCustomInputs] = useState('{}');

  // ワークフロー一覧を読み込む
  useEffect(() => {
    if (open) {
      loadWorkflows();
    }
  }, [open]);

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

  const handleAdd = () => {
    if (!selectedWorkflowId) {
      alert('ワークフローを選択してください');
      return;
    }

    // カスタム入力のJSONをパース
    let parsedCustomInputs = {};
    if (customInputs.trim()) {
      try {
        parsedCustomInputs = JSON.parse(customInputs);
      } catch (err) {
        alert('カスタム入力のJSON形式が正しくありません');
        return;
      }
    }

    const inputConfig = {
      usePrompt,
      prompt: usePrompt ? prompt : undefined,
      usePreviousImage: hasPreviousSteps ? usePreviousImage : false,
      usePreviousVideo: hasPreviousSteps ? usePreviousVideo : false,
      usePreviousAudio: hasPreviousSteps ? usePreviousAudio : false,
      usePreviousText: hasPreviousSteps ? usePreviousText : false,
      customInputs: Object.keys(parsedCustomInputs).length > 0 ? parsedCustomInputs : undefined,
    };

    onAdd({
      workflow_id: selectedWorkflowId,
      input_config: inputConfig,
    });

    // フォームをリセット
    setSelectedWorkflowId(null);
    setUsePrompt(true);
    setPrompt('');
    setUsePreviousImage(false);
    setUsePreviousVideo(false);
    setUsePreviousAudio(false);
    setUsePreviousText(false);
    setCustomInputs('{}');
  };

  const handleClose = () => {
    onClose();
    // フォームをリセット
    setSelectedWorkflowId(null);
    setUsePrompt(true);
    setPrompt('');
    setUsePreviousImage(false);
    setUsePreviousVideo(false);
    setUsePreviousAudio(false);
    setUsePreviousText(false);
    setCustomInputs('{}');
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>ワークフローステップを追加</DialogTitle>
      <DialogContent>
        {loadingWorkflows ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress />
            <Typography sx={{ mt: 2 }}>読み込み中...</Typography>
          </Box>
        ) : (
          <Box sx={{ mt: 2 }}>
            {/* ワークフロー選択 */}
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>ワークフロー</InputLabel>
              <Select
                value={selectedWorkflowId || ''}
                onChange={(e) => setSelectedWorkflowId(Number(e.target.value))}
                label="ワークフロー"
              >
                {workflows.map((workflow) => (
                  <MenuItem key={workflow.id} value={workflow.id}>
                    {workflow.name} {workflow.description && `- ${workflow.description}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedWorkflowId && (
              <>
                <Divider sx={{ my: 3 }} />

                {/* 入力設定 */}
                <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                  入力設定
                </Typography>

                {/* プロンプト */}
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={usePrompt}
                      onChange={(e) => setUsePrompt(e.target.checked)}
                    />
                  }
                  label="プロンプトを使用"
                  sx={{ mb: 1 }}
                />

                {usePrompt && (
                  <TextField
                    label="プロンプト"
                    fullWidth
                    multiline
                    rows={3}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    sx={{ mb: 2 }}
                    placeholder="このステップで使用するプロンプトを入力..."
                  />
                )}

                {/* 前のステップの出力を使用 */}
                {hasPreviousSteps && (
                  <>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                      前のステップの出力を使用:
                    </Typography>
                    <FormGroup sx={{ mb: 2, ml: 2 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={usePreviousImage}
                            onChange={(e) => setUsePreviousImage(e.target.checked)}
                          />
                        }
                        label="画像"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={usePreviousVideo}
                            onChange={(e) => setUsePreviousVideo(e.target.checked)}
                          />
                        }
                        label="動画"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={usePreviousAudio}
                            onChange={(e) => setUsePreviousAudio(e.target.checked)}
                          />
                        }
                        label="音声"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={usePreviousText}
                            onChange={(e) => setUsePreviousText(e.target.checked)}
                          />
                        }
                        label="テキスト"
                      />
                    </FormGroup>
                  </>
                )}

                {!hasPreviousSteps && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    これが最初のステップです。前のステップの出力は使用できません。
                  </Alert>
                )}

                <Divider sx={{ my: 2 }} />

                {/* カスタム入力 */}
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  カスタム入力（JSON形式、オプション）:
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  value={customInputs}
                  onChange={(e) => setCustomInputs(e.target.value)}
                  placeholder='{"aspectRatio": "16:9", "duration": 5}'
                  sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  ワークフローに追加の入力パラメータを指定できます
                </Typography>
              </>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>キャンセル</Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          disabled={!selectedWorkflowId || loadingWorkflows}
        >
          追加
        </Button>
      </DialogActions>
    </Dialog>
  );
}
