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
  Avatar,
  Tooltip,
  IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import ImageIcon from '@mui/icons-material/Image';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DeleteIcon from '@mui/icons-material/Delete';
import DynamicFormField, { FormFieldConfig } from '@/components/form/DynamicFormField';

interface CharacterSheet {
  id: number;
  name: string;
  image_url: string | null;
  description: string | null;
}

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

  // ノード設定の上書き
  const [nodeOverrides, setNodeOverrides] = useState<Record<string, any>>({});

  // 入力設定（従来の設定も維持）
  const [usePrompt, setUsePrompt] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [usePreviousImage, setUsePreviousImage] = useState(false);
  const [usePreviousVideo, setUsePreviousVideo] = useState(false);
  const [usePreviousAudio, setUsePreviousAudio] = useState(false);

  // キャラクターシート関連
  const [characterSheets, setCharacterSheets] = useState<CharacterSheet[]>([]);
  const [characterDialogOpen, setCharacterDialogOpen] = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
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

  // キャラクターシートを読み込む
  const loadCharacterSheets = async () => {
    try {
      const response = await fetch('/api/character-sheets');
      const result = await response.json();
      if (result.success && result.data?.characterSheets) {
        setCharacterSheets(result.data.characterSheets);
      }
    } catch (error) {
      console.error('Failed to load character sheets:', error);
    }
  };

  // キャラクターシートを追加
  const handleAddCharacterSheet = (characterSheetId: number, nodeId: string) => {
    setNodeOverrides(prev => {
      const currentIds = prev[nodeId]?.selectedCharacterSheetIds || [];
      if (currentIds.includes(characterSheetId) || currentIds.length >= 4) {
        return prev;
      }
      return {
        ...prev,
        [nodeId]: {
          ...prev[nodeId],
          selectedCharacterSheetIds: [...currentIds, characterSheetId]
        }
      };
    });
    setCharacterDialogOpen(false);
  };

  // キャラクターシートを削除
  const handleRemoveCharacterSheet = (characterSheetId: number, nodeId: string) => {
    setNodeOverrides(prev => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        selectedCharacterSheetIds: (prev[nodeId]?.selectedCharacterSheetIds || []).filter(
          (id: number) => id !== characterSheetId
        )
      }
    }));
  };

  // ダイアログが開いたときの初期化
  useEffect(() => {
    if (open) {
      loadWorkflows();
      loadCharacterSheets();
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
        // ノード設定の上書きを復元
        if (editStep.input_config?.nodeOverrides) {
          console.log('Restoring nodeOverrides:', editStep.input_config.nodeOverrides);
          setNodeOverrides(editStep.input_config.nodeOverrides);
        } else {
          console.log('No nodeOverrides to restore');
          setNodeOverrides({});
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
        setNodeOverrides({});
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

  // nodeOverridesからformValuesへの値を抽出する関数
  const extractFormValuesFromNodeOverrides = (
    nodeOverrides: Record<string, any>,
    workflow: Workflow
  ): Record<string, any> => {
    const extracted: Record<string, any> = {};

    if (!workflow.form_config?.fields) {
      return extracted;
    }

    // form_config.fieldsに存在するフィールド名のセットを作成
    const formFieldNames = new Set(workflow.form_config.fields.map(f => f.name));

    // 各ノードのnodeOverridesを走査
    Object.entries(nodeOverrides).forEach(([nodeId, config]) => {
      if (!config || typeof config !== 'object') return;

      // configの各フィールドをformValuesに展開
      Object.entries(config).forEach(([key, value]) => {
        // 同じフィールド名がform_config.fieldsに存在する場合のみ展開
        if (formFieldNames.has(key)) {
          // 既に値がある場合は上書きしない（最初に見つかった値を優先）
          if (extracted[key] === undefined) {
            extracted[key] = value;
            console.log(`[extractFormValues] Extracted ${key} = ${JSON.stringify(value)} from node ${nodeId}`);
          }
        }
      });
    });

    return extracted;
  };

  // ワークフロー詳細読み込み後、nodeOverridesの値をformValuesにマージ
  useEffect(() => {
    if (selectedWorkflow && isEditMode && editStep?.input_config?.nodeOverrides) {
      console.log('[AddWorkflowStepDialog] Merging nodeOverrides into formValues');
      console.log('nodeOverrides:', editStep.input_config.nodeOverrides);
      console.log('form_config.fields:', selectedWorkflow.form_config?.fields);

      const extractedValues = extractFormValuesFromNodeOverrides(
        editStep.input_config.nodeOverrides,
        selectedWorkflow
      );

      console.log('Extracted values from nodeOverrides:', extractedValues);

      if (Object.keys(extractedValues).length > 0) {
        setFormValues(prev => {
          const merged = {
            ...prev,
            ...extractedValues  // nodeOverridesの値で上書き
          };
          console.log('Merged formValues:', merged);
          return merged;
        });
      }
    }
  }, [selectedWorkflow, isEditMode, editStep]);

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
      // ノード設定の上書き（存在する場合）
      nodeOverrides: Object.keys(nodeOverrides).length > 0 ? nodeOverrides : undefined,
      // メタデータを保持（編集時）
      character_id: editStep?.input_config?.character_id,
      character_name: editStep?.input_config?.character_name,
      has_custom_voice: editStep?.input_config?.has_custom_voice,
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
      setNodeOverrides({});
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
      setNodeOverrides({});
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

                {/* ノード設定の上書き */}
                {Object.keys(nodeOverrides).length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                      ノード設定
                      {editStep?.input_config?.character_name && (
                        <Chip
                          label={editStep.input_config.character_name}
                          size="small"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                      会話から生成されたノード設定を編集できます
                    </Typography>
                    <Stack spacing={2}>
                      {Object.entries(nodeOverrides).map(([nodeId, config]: [string, any]) => (
                        <Paper key={nodeId} variant="outlined" sx={{ p: 2 }}>
                          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                            ノードID: {nodeId}
                          </Typography>

                          {/* テキスト（ElevenLabsノード用） */}
                          {config.text !== undefined && (
                            <Box sx={{ mb: 2 }}>
                              <TextField
                                label="テキスト"
                                fullWidth
                                multiline
                                rows={3}
                                value={config.text || ''}
                                onChange={(e) => {
                                  setNodeOverrides(prev => ({
                                    ...prev,
                                    [nodeId]: {
                                      ...prev[nodeId],
                                      text: e.target.value,
                                    }
                                  }));
                                }}
                                variant="outlined"
                                size="small"
                              />
                            </Box>
                          )}

                          {/* 音声ID（ElevenLabsノード用） */}
                          {config.voiceId !== undefined && (
                            <Box sx={{ mb: 2 }}>
                              <TextField
                                label="音声ID"
                                fullWidth
                                value={config.voiceId || ''}
                                onChange={(e) => {
                                  setNodeOverrides(prev => ({
                                    ...prev,
                                    [nodeId]: {
                                      ...prev[nodeId],
                                      voiceId: e.target.value,
                                    }
                                  }));
                                }}
                                variant="outlined"
                                size="small"
                                helperText="ElevenLabsの音声ID（例: JBFqnCBsd6RMkjVDRZzb）"
                              />
                            </Box>
                          )}

                          {/* モデルID（ElevenLabsノード用） */}
                          {config.modelId !== undefined && (
                            <Box sx={{ mb: 2 }}>
                              <TextField
                                label="モデルID"
                                fullWidth
                                value={config.modelId || ''}
                                onChange={(e) => {
                                  setNodeOverrides(prev => ({
                                    ...prev,
                                    [nodeId]: {
                                      ...prev[nodeId],
                                      modelId: e.target.value,
                                    }
                                  }));
                                }}
                                variant="outlined"
                                size="small"
                                helperText="ElevenLabsのモデルID（例: eleven_turbo_v2_5）"
                              />
                            </Box>
                          )}

                          {/* プロンプト（Nanobanaノード用） */}
                          {config.prompt !== undefined && (
                            <Box sx={{ mb: 2 }}>
                              <TextField
                                label="プロンプト"
                                fullWidth
                                multiline
                                rows={4}
                                value={config.prompt || ''}
                                onChange={(e) => {
                                  setNodeOverrides(prev => ({
                                    ...prev,
                                    [nodeId]: {
                                      ...prev[nodeId],
                                      prompt: e.target.value,
                                    }
                                  }));
                                }}
                                variant="outlined"
                                size="small"
                                helperText="Nanobana画像生成用のプロンプト"
                              />
                            </Box>
                          )}

                          {/* アスペクト比（Nanobanaノード用） */}
                          {config.aspectRatio !== undefined && (
                            <Box sx={{ mb: 2 }}>
                              <FormControl fullWidth size="small">
                                <InputLabel>アスペクト比</InputLabel>
                                <Select
                                  value={config.aspectRatio || '16:9'}
                                  onChange={(e) => {
                                    setNodeOverrides(prev => ({
                                      ...prev,
                                      [nodeId]: {
                                        ...prev[nodeId],
                                        aspectRatio: e.target.value,
                                      }
                                    }));
                                  }}
                                  label="アスペクト比"
                                >
                                  <MenuItem value="16:9">16:9（横長）</MenuItem>
                                  <MenuItem value="9:16">9:16（縦長）</MenuItem>
                                  <MenuItem value="4:3">4:3</MenuItem>
                                  <MenuItem value="3:4">3:4</MenuItem>
                                  <MenuItem value="1:1">1:1（正方形）</MenuItem>
                                </Select>
                              </FormControl>
                            </Box>
                          )}

                          {/* キャラクターシート選択（Nanobanaノード用） */}
                          {config.selectedCharacterSheetIds !== undefined && (
                            <Box>
                              <Typography variant="caption" fontWeight={600} display="block" gutterBottom>
                                登場キャラクター（最大4人）
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                {config.selectedCharacterSheetIds?.length === 0 && (
                                  <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                                    キャラクターが選択されていません
                                  </Typography>
                                )}

                                {config.selectedCharacterSheetIds?.map((sheetId: number) => {
                                  const sheet = characterSheets.find(cs => cs.id === sheetId);
                                  return (
                                    <Box key={sheetId} sx={{ position: 'relative' }}>
                                      <Tooltip title={sheet?.name || `ID: ${sheetId}`}>
                                        <Avatar
                                          src={sheet?.image_url || undefined}
                                          alt={sheet?.name}
                                          sx={{ width: 40, height: 40, border: '2px solid', borderColor: 'primary.main' }}
                                        />
                                      </Tooltip>
                                      <IconButton
                                        size="small"
                                        onClick={() => handleRemoveCharacterSheet(sheetId, nodeId)}
                                        sx={{
                                          position: 'absolute',
                                          top: -8,
                                          right: -8,
                                          bgcolor: 'error.main',
                                          color: 'white',
                                          width: 20,
                                          height: 20,
                                          '&:hover': { bgcolor: 'error.dark' }
                                        }}
                                      >
                                        <DeleteIcon sx={{ fontSize: 14 }} />
                                      </IconButton>
                                    </Box>
                                  );
                                })}

                                <Tooltip title="キャラクターを追加">
                                  <span>
                                    <IconButton
                                      onClick={() => {
                                        setCurrentNodeId(nodeId);
                                        setCharacterDialogOpen(true);
                                      }}
                                      disabled={(config.selectedCharacterSheetIds?.length || 0) >= 4}
                                      sx={{
                                        border: '2px dashed',
                                        borderColor: (config.selectedCharacterSheetIds?.length || 0) >= 4 ? 'action.disabled' : 'primary.main',
                                        borderRadius: '50%',
                                        width: 40,
                                        height: 40,
                                        color: (config.selectedCharacterSheetIds?.length || 0) >= 4 ? 'action.disabled' : 'primary.main'
                                      }}
                                    >
                                      <PersonAddIcon sx={{ fontSize: 20 }} />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </Box>
                            </Box>
                          )}
                        </Paper>
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

      {/* キャラクターシート選択ダイアログ */}
      <Dialog
        open={characterDialogOpen}
        onClose={() => setCharacterDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>キャラクターシートを選択</DialogTitle>
        <DialogContent>
          {characterSheets.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              キャラクターシートがありません
            </Typography>
          ) : (
            <List>
              {characterSheets
                .filter(sheet => {
                  if (!currentNodeId) return false;
                  const currentIds = nodeOverrides[currentNodeId]?.selectedCharacterSheetIds || [];
                  return !currentIds.includes(sheet.id);
                })
                .map(sheet => (
                  <ListItem key={sheet.id} disablePadding sx={{ py: 1 }}>
                    <ListItemButton
                      onClick={() => currentNodeId && handleAddCharacterSheet(sheet.id, currentNodeId)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                        <Avatar src={sheet.image_url || undefined} alt={sheet.name} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body1">{sheet.name}</Typography>
                          {sheet.description && (
                            <Typography variant="caption" color="text.secondary">
                              {sheet.description}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </ListItemButton>
                  </ListItem>
                ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCharacterDialogOpen(false)}>キャンセル</Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
