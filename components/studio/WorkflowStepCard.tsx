'use client';

import { useState } from 'react';
import {
  Box,
  Card,
  Typography,
  IconButton,
  Button,
  Chip,
  Stack,
  CircularProgress,
  Collapse,
  Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PendingIcon from '@mui/icons-material/Pending';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ImageIcon from '@mui/icons-material/Image';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import TextFieldsIcon from '@mui/icons-material/TextFields';

interface WorkflowStep {
  id: number;
  board_id: number;
  workflow_id: number;
  workflow_name?: string;
  workflow_description?: string;
  step_order: number;
  input_config: {
    usePrompt?: boolean;
    prompt?: string;
    usePreviousImage?: boolean;
    usePreviousVideo?: boolean;
    usePreviousAudio?: boolean;
    usePreviousText?: boolean;
    customInputs?: any;
  };
  execution_status: 'pending' | 'running' | 'completed' | 'failed';
  output_data: any;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkflowStepCardProps {
  step: WorkflowStep;
  onUpdate: (step: WorkflowStep) => void;
  onDelete: (stepId: number) => void;
  onEdit?: (step: WorkflowStep) => void;
}

export default function WorkflowStepCard({ step, onUpdate, onDelete, onEdit }: WorkflowStepCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const getStatusIcon = () => {
    switch (step.execution_status) {
      case 'completed':
        return <CheckCircleIcon fontSize="small" color="success" />;
      case 'running':
        return <CircularProgress size={16} />;
      case 'failed':
        return <ErrorIcon fontSize="small" color="error" />;
      default:
        return <PendingIcon fontSize="small" color="action" />;
    }
  };

  const getStatusColor = () => {
    switch (step.execution_status) {
      case 'completed':
        return 'success';
      case 'running':
        return 'info';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = () => {
    switch (step.execution_status) {
      case 'completed':
        return '完了';
      case 'running':
        return '実行中';
      case 'failed':
        return '失敗';
      default:
        return '待機中';
    }
  };

  const hasOutput = step.output_data && Object.keys(step.output_data).length > 0;

  return (
    <>
      <Card
        variant="outlined"
        sx={{
          borderLeft: 4,
          borderLeftColor:
            step.execution_status === 'completed' ? 'success.main' :
            step.execution_status === 'running' ? 'info.main' :
            step.execution_status === 'failed' ? 'error.main' :
            'grey.300',
        }}
      >
        <Box sx={{ p: 2 }}>
          {/* ヘッダー */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {/* ステップ番号 */}
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  flexShrink: 0,
                }}
              >
                {step.step_order + 1}
              </Box>

              {/* ワークフロー名 */}
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {step.workflow_name || `ワークフロー ${step.workflow_id}`}
                </Typography>
                {step.workflow_description && (
                  <Typography variant="caption" color="text.secondary">
                    {step.workflow_description}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* アクション */}
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Chip
                icon={getStatusIcon()}
                label={getStatusLabel()}
                color={getStatusColor()}
                size="small"
                variant="outlined"
              />
              {onEdit && step.execution_status === 'pending' && (
                <IconButton size="small" onClick={() => onEdit(step)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
              {step.execution_status === 'pending' && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => onDelete(step.id)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
              <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            </Stack>
          </Box>

          {/* 入力設定のサマリー */}
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {step.input_config.usePrompt && (
              <Chip
                icon={<TextFieldsIcon fontSize="small" />}
                label="プロンプト"
                size="small"
                variant="outlined"
              />
            )}
            {step.input_config.usePreviousImage && (
              <Chip
                icon={<ImageIcon fontSize="small" />}
                label="前の画像"
                size="small"
                variant="outlined"
              />
            )}
            {step.input_config.usePreviousVideo && (
              <Chip
                icon={<VideoLibraryIcon fontSize="small" />}
                label="前の動画"
                size="small"
                variant="outlined"
              />
            )}
            {step.input_config.usePreviousAudio && (
              <Chip
                icon={<AudiotrackIcon fontSize="small" />}
                label="前の音声"
                size="small"
                variant="outlined"
              />
            )}
          </Stack>

          {/* 展開エリア */}
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ mt: 2 }}>
              {/* プロンプト */}
              {step.input_config.usePrompt && step.input_config.prompt && (
                <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    プロンプト
                  </Typography>
                  <Typography variant="body2">{step.input_config.prompt}</Typography>
                </Box>
              )}

              {/* カスタム入力 */}
              {step.input_config.customInputs && Object.keys(step.input_config.customInputs).length > 0 && (
                <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    カスタム入力
                  </Typography>
                  <Box component="pre" sx={{ fontSize: '0.75rem', m: 0, whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(step.input_config.customInputs, null, 2)}
                  </Box>
                </Box>
              )}

              {/* 出力データ */}
              {hasOutput && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    出力
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                    {step.output_data.imageData && (
                      <Chip
                        icon={<ImageIcon fontSize="small" />}
                        label="画像"
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    )}
                    {step.output_data.videoUrl && (
                      <Chip
                        icon={<VideoLibraryIcon fontSize="small" />}
                        label="動画"
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    )}
                    {step.output_data.audioUrl && (
                      <Chip
                        icon={<AudiotrackIcon fontSize="small" />}
                        label="音声"
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    )}
                    {step.output_data.text && (
                      <Chip
                        icon={<TextFieldsIcon fontSize="small" />}
                        label="テキスト"
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    )}
                  </Stack>
                </Box>
              )}

              {/* エラーメッセージ */}
              {step.error_message && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {step.error_message}
                </Alert>
              )}
            </Box>
          </Collapse>
        </Box>
      </Card>
    </>
  );
}
