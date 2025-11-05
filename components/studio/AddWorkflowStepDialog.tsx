'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Stack,
  Chip,
  Paper,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import ImageIcon from '@mui/icons-material/Image';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import DynamicFormField, { FormFieldConfig } from '@/components/form/DynamicFormField';

interface Workflow {
  id: number;
  name: string;
  description: string;
  nodes?: any[];
  edges?: any[];
  form_config?: {
    fields: FormFieldConfig[];
  };
}

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

interface AddWorkflowStepDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (stepData: { workflow_id: number; input_config: any }) => void;
  onUpdate?: (stepId: number, stepData: { workflow_id: number; input_config: any }) => void;
  hasPreviousSteps: boolean;
  editStep?: WorkflowStep | null;
}

export default function AddWorkflowStepDialog({
  open,
  onClose,
  onAdd,
  onUpdate,
  hasPreviousSteps,
  editStep = null,
}: AddWorkflowStepDialogProps) {
  const isEditMode = !!editStep;

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [loadingWorkflowDetails, setLoadingWorkflowDetails] = useState(false);

  // 動的フォームの値
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  // 入力設定（従来の設定も維持）
  const [usePrompt, setUsePrompt] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [usePreviousImage, setUsePreviousImage] = useState(false);
  const [usePreviousVideo, setUsePreviousVideo] = useState(false);
  const [usePreviousAudio, setUsePreviousAudio] = useState(false);
  const [usePreviousText, setUsePreviousText] = useState(false);

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

  // ワークフロー詳細を読み込む
  const loadWorkflowDetails = useCallback(async (workflowId: number) => {
    try {
      setLoadingWorkflowDetails(true);
      const response = await fetch(`/api/workflows/${workflowId}`);
      const data = await response.json();

      if (data.success) {
        setSelectedWorkflow(data.workflow);

        // フォームの初期値は既にuseEffectで設定済みなので、
        // ここでは上書きしない（編集モードの値を保持）
        console.log('Workflow details loaded, keeping existing form values');
      }
    } catch (err) {
      console.error('Failed to load workflow details:', err);
    } finally {
      setLoadingWorkflowDetails(false);
    }
  }, []);

  // ダイアログが開いたときの初期化
  useEffect(() => {
    if (open) {
      loadWorkflows();
      // 編集モードの場合、初期値を設定
      if (isEditMode && editStep) {
        console.log('Setting edit mode initial values:', {
          workflow_id: editStep.workflow_id,
          input_config: editStep.input_config,
        });
        setSelectedWorkflowId(editStep.workflow_id);
        // フォームの値を復元
        if (editStep.input_config?.workflowInputs) {
          console.log('Restoring workflowInputs:', editStep.input_config.workflowInputs);
          setFormValues(editStep.input_config.workflowInputs);
        } else {
          console.log('No workflowInputs to restore');
          setFormValues({});
        }
        // その他の入力設定も復元
        setUsePrompt(editStep.input_config?.usePrompt || false);
        setPrompt(editStep.input_config?.prompt || '');
        setUsePreviousImage(editStep.input_config?.usePreviousImage || false);
        setUsePreviousVideo(editStep.input_config?.usePreviousVideo || false);
        setUsePreviousAudio(editStep.input_config?.usePreviousAudio || false);
        setUsePreviousText(editStep.input_config?.usePreviousText || false);
      } else {
        // 新規追加モードの場合は初期化
        console.log('New step mode - resetting values');
        setSelectedWorkflowId(null);
        setFormValues({});
        setUsePrompt(false);
        setPrompt('');
        setUsePreviousImage(false);
        setUsePreviousVideo(false);
        setUsePreviousAudio(false);
        setUsePreviousText(false);
      }
    }
  }, [open, isEditMode, editStep]);

  // 選択されたワークフローの詳細を読み込む
  useEffect(() => {
    if (selectedWorkflowId) {
      loadWorkflowDetails(selectedWorkflowId);
    } else {
      setSelectedWorkflow(null);
      if (!isEditMode) {
        setFormValues({});
      }
    }
  }, [selectedWorkflowId, isEditMode, loadWorkflowDetails]);

  // デバッグ: formValuesの変更を監視
  useEffect(() => {
    console.log('Form values changed:', formValues);
  }, [formValues]);

  // 出力タイプを判定する関数（最終ノードのみ）
  const getWorkflowOutputTypes = (workflow: Workflow | null): string[] => {
    if (!workflow?.nodes || workflow.nodes.length === 0) return [];

    const outputTypes: string[] = [];

    // エッジから最終ノードを特定（sourceとして使われていないノード）
    const edges = workflow.edges || [];
    const sourceNodeIds = new Set(edges.map((edge: any) => edge.source));

    // 最終ノード（他のノードへの出力エッジがないノード）を見つける
    const finalNodes = workflow.nodes.filter((node: any) => !sourceNodeIds.has(node.id));

    console.log('Final nodes:', finalNodes.map((n: any) => ({ id: n.id, type: n.type || n.data?.type })));

    // 最終ノードから出力タイプを判定
    finalNodes.forEach((node: any) => {
      const nodeType = node.type || node.data?.type;

      // 画像生成系ノード
      if (['geminiVision', 'nanobana', 'imageInput', 'imageGen'].includes(nodeType)) {
        if (!outputTypes.includes('image')) outputTypes.push('image');
      }

      // 動画生成系ノード
      if (['higgsfield', 'seedream4'].includes(nodeType)) {
        if (!outputTypes.includes('video')) outputTypes.push('video');
      }

      // 音声生成系ノード
      if (['elevenlabs', 'audioGen', 'textToSpeech', 'tts'].includes(nodeType)) {
        if (!outputTypes.includes('audio')) outputTypes.push('audio');
      }

      // テキスト生成系ノード
      if (['gemini', 'claude', 'openai', 'textGen', 'input'].includes(nodeType)) {
        if (!outputTypes.includes('text')) outputTypes.push('text');
      }
    });

    return outputTypes;
  };

  const renderOutputTypeChip = (type: string) => {
    switch (type) {
      case 'image':
        return <Chip icon={<ImageIcon fontSize="small" />} label="画像" size="small" color="primary" variant="outlined" />;
      case 'video':
        return <Chip icon={<VideoLibraryIcon fontSize="small" />} label="動画" size="small" color="secondary" variant="outlined" />;
      case 'audio':
        return <Chip icon={<AudiotrackIcon fontSize="small" />} label="音声" size="small" color="success" variant="outlined" />;
      case 'text':
        return <Chip icon={<TextFieldsIcon fontSize="small" />} label="テキスト" size="small" color="info" variant="outlined" />;
      default:
        return null;
    }
  };

  const handleSave = () => {
    if (!selectedWorkflowId) {
      alert('ワークフローを選択してください');
      return;
    }

    // 入力されたフィールドのみを抽出
    const filledFormValues: Record<string, any> = {};
    Object.entries(formValues).forEach(([key, value]) => {
      // 値が存在する場合のみ追加
      if (value !== null && value !== undefined && value !== '' &&
          (!Array.isArray(value) || value.length > 0)) {
        filledFormValues[key] = value;
      }
    });

    const inputConfig = {
      usePrompt,
      prompt: usePrompt ? prompt : undefined,
      usePreviousImage: hasPreviousSteps ? usePreviousImage : false,
      usePreviousVideo: hasPreviousSteps ? usePreviousVideo : false,
      usePreviousAudio: hasPreviousSteps ? usePreviousAudio : false,
      usePreviousText: hasPreviousSteps ? usePreviousText : false,
      // 入力されたフィールドのみを追加
      workflowInputs: Object.keys(filledFormValues).length > 0 ? filledFormValues : undefined,
    };

    const stepData = {
      workflow_id: selectedWorkflowId,
      input_config: inputConfig,
    };

    if (isEditMode && editStep && onUpdate) {
      // 編集モード
      onUpdate(editStep.id, stepData);
    } else {
      // 新規追加モード
      onAdd(stepData);
    }

    // フォームをリセット
    resetForm();
  };

  const resetForm = () => {
    if (!isEditMode) {
      setSelectedWorkflowId(null);
      setSelectedWorkflow(null);
      setFormValues({});
      setUsePrompt(false);
      setPrompt('');
      setUsePreviousImage(false);
      setUsePreviousVideo(false);
      setUsePreviousAudio(false);
      setUsePreviousText(false);
    }
  };

  const handleClose = () => {
    onClose();
    // ダイアログを閉じるときだけリセット
    setTimeout(() => {
      setSelectedWorkflowId(null);
      setSelectedWorkflow(null);
      setFormValues({});
      setUsePrompt(false);
      setPrompt('');
      setUsePreviousImage(false);
      setUsePreviousVideo(false);
      setUsePreviousAudio(false);
      setUsePreviousText(false);
    }, 200);
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const outputTypes = getWorkflowOutputTypes(selectedWorkflow);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEditMode ? 'ワークフローステップを編集' : 'ワークフローステップを追加'}</DialogTitle>
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
                disabled={isEditMode}
              >
                {workflows.map((workflow) => (
                  <MenuItem key={workflow.id} value={workflow.id}>
                    {workflow.name} {workflow.description && `- ${workflow.description}`}
                  </MenuItem>
                ))}
              </Select>
              {isEditMode && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  編集モードではワークフローの変更はできません
                </Typography>
              )}
            </FormControl>

            {loadingWorkflowDetails && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={24} />
                <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                  ワークフロー詳細を読み込んでいます...
                </Typography>
              </Box>
            )}

            {selectedWorkflowId && !loadingWorkflowDetails && (
              <>
                {/* ワークフロー出力タイプ */}
                {outputTypes.length > 0 && (
                  <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'primary.50' }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      このワークフローの出力
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                      {outputTypes.map((type) => (
                        <Box key={type}>
                          {renderOutputTypeChip(type)}
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                )}

                <Divider sx={{ my: 3 }} />

                {/* ワークフロー固有の入力フィールド */}
                {selectedWorkflow?.form_config?.fields && selectedWorkflow.form_config.fields.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                      ワークフロー入力
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                      このワークフローに必要な入力を設定してください
                    </Typography>
                    <Stack spacing={3}>
                      {selectedWorkflow.form_config.fields.map((field) => (
                        <DynamicFormField
                          key={field.name}
                          config={field}
                          value={formValues[field.name]}
                          onChange={(value) => handleFieldChange(field.name, value)}
                        />
                      ))}
                    </Stack>
                    <Divider sx={{ my: 3 }} />
                  </Box>
                )}

                {/* 追加設定 */}
                <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                  追加設定（オプション）
                </Typography>

                {/* プロンプト */}
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={usePrompt}
                      onChange={(e) => setUsePrompt(e.target.checked)}
                    />
                  }
                  label="カスタムプロンプトを追加"
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
                    placeholder="追加のプロンプトを入力..."
                    helperText="ワークフロー入力に追加で渡すプロンプトを指定できます"
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
              </>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>キャンセル</Button>
        <Button
          variant="contained"
          startIcon={isEditMode ? <SaveIcon /> : <AddIcon />}
          onClick={handleSave}
          disabled={!selectedWorkflowId || loadingWorkflows || loadingWorkflowDetails}
        >
          {isEditMode ? '保存' : '追加'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
