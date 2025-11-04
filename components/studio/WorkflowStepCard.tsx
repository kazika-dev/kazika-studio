'use client';

import { useState, useEffect } from 'react';
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
    workflowInputs?: Record<string, any>;
  };
  execution_status: 'pending' | 'running' | 'completed' | 'failed';
  output_data: any;
  error_message: string | null;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

interface WorkflowStepCardProps {
  step: WorkflowStep;
  onUpdate: (step: WorkflowStep) => void;
  onDelete: (stepId: number) => void;
  onEdit?: (step: WorkflowStep) => void;
  onExecute?: (stepId: number) => void;
}

export default function WorkflowStepCard({ step, onUpdate, onDelete, onEdit, onExecute }: WorkflowStepCardProps) {
  // 初期状態では全てのアコーディオンを閉じる
  const [expanded, setExpanded] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailedStep, setDetailedStep] = useState<WorkflowStep>(step);

  // stepプロパティが更新された時にdetailedStepも更新
  useEffect(() => {
    setDetailedStep(step);
    // output_dataまたはmetadataがある場合は詳細が既に読み込まれている
    if (step.output_data || step.metadata) {
      setDetailsLoaded(true);
    }
  }, [step]);

  // アコーディオンが展開された時に詳細を読み込む
  useEffect(() => {
    const loadDetails = async () => {
      if (expanded && !detailsLoaded && !loadingDetails) {
        setLoadingDetails(true);
        try {
          const response = await fetch(`/api/studios/steps/${step.id}`);
          const data = await response.json();

          if (data.success && data.step) {
            setDetailedStep(data.step);
            setDetailsLoaded(true);
            // 親コンポーネントにも通知
            if (onUpdate) {
              onUpdate(data.step);
            }
          }
        } catch (error) {
          console.error('Failed to load step details:', error);
        } finally {
          setLoadingDetails(false);
        }
      }
    };

    loadDetails();
  }, [expanded, detailsLoaded, loadingDetails, step.id, onUpdate]);

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

  const hasOutput = detailedStep.output_data && Object.keys(detailedStep.output_data).length > 0;

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
          bgcolor: step.execution_status === 'failed' ? 'error.50' : 'background.paper',
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
              {/* 個別実行ボタン - 実行中以外で表示 */}
              {onExecute && step.execution_status !== 'running' && (
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => onExecute(step.id)}
                  title="このステップを実行"
                >
                  <PlayArrowIcon fontSize="small" />
                </IconButton>
              )}
              {/* 編集ボタン - 実行中以外で表示 */}
              {onEdit && step.execution_status !== 'running' && (
                <IconButton size="small" onClick={() => onEdit(step)} title="編集">
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
              {/* 削除ボタン - 実行中以外で表示 */}
              {step.execution_status !== 'running' && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => onDelete(step.id)}
                  title="削除"
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
              {/* 読み込み中 */}
              {loadingDetails && (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <CircularProgress size={24} />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    詳細を読み込み中...
                  </Typography>
                </Box>
              )}

              {/* プロンプト */}
              {!loadingDetails && step.input_config.usePrompt && step.input_config.prompt && (
                <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    プロンプト
                  </Typography>
                  <Typography variant="body2">{step.input_config.prompt}</Typography>
                </Box>
              )}

              {/* ワークフロー入力 */}
              {!loadingDetails && step.input_config.workflowInputs && Object.keys(step.input_config.workflowInputs).length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    ワークフロー入力
                  </Typography>
                  <Stack spacing={1.5}>
                    {Object.entries(step.input_config.workflowInputs).map(([key, value]) => (
                      <Box key={key} sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="caption" fontWeight={600} color="text.secondary" display="block">
                          {key}
                        </Typography>
                        {/* 画像データの場合 */}
                        {value && typeof value === 'object' && value.mimeType && value.data ? (
                          <Box sx={{ mt: 1 }}>
                            <img
                              src={`data:${value.mimeType};base64,${value.data}`}
                              alt={key}
                              style={{ maxWidth: '200px', maxHeight: '150px', objectFit: 'contain', borderRadius: '4px' }}
                            />
                          </Box>
                        ) : /* 画像配列の場合 */
                        Array.isArray(value) && value.length > 0 && value[0].mimeType && value[0].data ? (
                          <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {value.map((img: any, idx: number) => (
                              <img
                                key={idx}
                                src={`data:${img.mimeType};base64,${img.data}`}
                                alt={`${key}-${idx}`}
                                style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '4px' }}
                              />
                            ))}
                          </Box>
                        ) : /* その他のデータ */
                        (
                          <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              {/* 実行時のリクエストプロンプト */}
              {!loadingDetails && detailedStep.metadata?.execution_requests && step.execution_status === 'completed' && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    実行時のAPIリクエスト
                  </Typography>
                  <Stack spacing={1.5}>
                    {Object.entries(detailedStep.metadata.execution_requests).map(([nodeId, request]: [string, any]) => (
                      <Box key={nodeId} sx={{ p: 1.5, bgcolor: 'primary.50', borderRadius: 1, border: '1px solid', borderColor: 'primary.200' }}>
                        <Typography variant="caption" fontWeight={600} color="primary.main" display="block" gutterBottom>
                          ノード: {nodeId}
                        </Typography>
                        {request.prompt && (
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="caption" color="text.secondary" display="block">
                              プロンプト:
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {request.prompt}
                            </Typography>
                          </Box>
                        )}
                        {request.text && (
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="caption" color="text.secondary" display="block">
                              テキスト:
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {request.text}
                            </Typography>
                          </Box>
                        )}
                        {request.aspectRatio && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            アスペクト比: {request.aspectRatio}
                          </Typography>
                        )}
                        {request.model && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            モデル: {request.model}
                          </Typography>
                        )}
                        {request.voiceId && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            音声ID: {request.voiceId}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              {/* 出力データ */}
              {!loadingDetails && hasOutput && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    出力
                  </Typography>
                  <Stack spacing={2}>
                    {Object.entries(detailedStep.output_data).map(([nodeId, output]: [string, any]) => {
                      if (!output) return null;

                      return (
                        <Box key={nodeId} sx={{ p: 1.5, bgcolor: 'success.50', borderRadius: 1, border: '1px solid', borderColor: 'success.200' }}>
                          <Typography variant="caption" fontWeight={600} color="success.dark" display="block" gutterBottom>
                            ノード: {nodeId}
                          </Typography>

                          {/* 画像出力 */}
                          {output.imageData && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                画像:
                              </Typography>
                              <Box
                                component="img"
                                src={`data:${output.imageData.mimeType || 'image/png'};base64,${output.imageData.data}`}
                                alt="出力画像"
                                sx={{
                                  maxWidth: '100%',
                                  maxHeight: '400px',
                                  objectFit: 'contain',
                                  borderRadius: 1,
                                  border: '1px solid',
                                  borderColor: 'grey.300',
                                }}
                              />
                            </Box>
                          )}

                          {/* 画像URL出力 */}
                          {output.imageUrl && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                画像:
                              </Typography>
                              <Box
                                component="img"
                                src={output.imageUrl}
                                alt="出力画像"
                                sx={{
                                  maxWidth: '100%',
                                  maxHeight: '400px',
                                  objectFit: 'contain',
                                  borderRadius: 1,
                                  border: '1px solid',
                                  borderColor: 'grey.300',
                                }}
                              />
                            </Box>
                          )}

                          {/* 動画出力 */}
                          {output.videoUrl && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                動画:
                              </Typography>
                              <Box
                                component="video"
                                src={output.videoUrl}
                                controls
                                sx={{
                                  maxWidth: '100%',
                                  maxHeight: '400px',
                                  borderRadius: 1,
                                  border: '1px solid',
                                  borderColor: 'grey.300',
                                }}
                              />
                            </Box>
                          )}

                          {/* 音声出力 */}
                          {output.audioData && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                音声:
                              </Typography>
                              <Box
                                component="audio"
                                src={`data:${output.audioData.mimeType || 'audio/mpeg'};base64,${output.audioData.data}`}
                                controls
                                sx={{
                                  width: '100%',
                                  maxWidth: '400px',
                                }}
                              />
                            </Box>
                          )}

                          {/* テキスト出力 */}
                          {output.response && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                テキスト:
                              </Typography>
                              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {output.response}
                              </Typography>
                            </Box>
                          )}

                          {/* その他の情報 */}
                          {output.storagePath && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                              保存パス: {output.storagePath}
                            </Typography>
                          )}
                          {output.jobId && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                              ジョブID: {output.jobId}
                            </Typography>
                          )}
                          {output.duration && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                              長さ: {output.duration}秒
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              )}

              {/* エラーメッセージ */}
              {step.error_message && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    エラーが発生しました
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {step.error_message}
                  </Typography>
                  {/* 画像生成失敗の場合のヒント */}
                  {(step.error_message.includes('Image generation failed') ||
                    step.error_message.includes('NO_IMAGE') ||
                    step.error_message.includes('blocked by safety filters') ||
                    step.error_message.includes('not suitable for image generation')) && (
                    <Box sx={{ mt: 2, p: 1.5, bgcolor: 'warning.50', borderRadius: 1, borderLeft: 3, borderColor: 'warning.main' }}>
                      <Typography variant="caption" fontWeight={600} display="block" gutterBottom>
                        💡 考えられる原因と対処法
                      </Typography>
                      <Typography variant="caption" display="block" component="div">
                        • <strong>プロンプトが長すぎる</strong>: プロンプトを短く簡潔にしてください（推奨: 500文字以内）
                        <br />
                        • <strong>安全フィルターによるブロック</strong>: 不適切な表現が含まれていないか確認してください
                        <br />
                        • <strong>抽象的すぎる内容</strong>: より具体的な描写を追加してください
                        <br />
                        • <strong>複数の要素を詰め込みすぎ</strong>: シンプルな構成に絞ってください
                      </Typography>
                    </Box>
                  )}
                </Alert>
              )}
            </Box>
          </Collapse>
        </Box>
      </Card>
    </>
  );
}
