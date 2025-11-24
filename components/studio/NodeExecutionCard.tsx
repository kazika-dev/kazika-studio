'use client';

import { useState } from 'react';
import {
  Box,
  Card,
  CardHeader,
  CardContent,
  Collapse,
  IconButton,
  Button,
  Chip,
  Typography,
  Avatar,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PendingIcon from '@mui/icons-material/Pending';
import CircularProgress from '@mui/material/CircularProgress';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ImageIcon from '@mui/icons-material/Image';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import InputIcon from '@mui/icons-material/Input';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EditIcon from '@mui/icons-material/Edit';

import OutputDataDisplay from './OutputDataDisplay';
import NodeInputEditDialog from './NodeInputEditDialog';

interface Node {
  id: string;
  type: string;
  data: {
    label?: string;
    type: string;
    config?: Record<string, any>;
  };
  position: { x: number; y: number };
}

interface NodeExecutionCardProps {
  node: Node;
  output?: any;
  request?: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  canExecute?: boolean;  // 依存ノードが完了しているか
  onExecute?: (nodeId: string) => Promise<void>;  // 実行ハンドラー
  stepId?: string;  // ステップID
  onInputsEdit?: (nodeId: string, inputs: Record<string, any>) => Promise<void>;  // 入力編集ハンドラー
  workflowInputs?: Record<string, any>;  // ワークフロー全体の入力
}

// ノードタイプごとのアイコンを取得
function getNodeTypeIcon(type: string) {
  switch (type) {
    case 'gemini':
      return <SmartToyIcon />;
    case 'nanobana':
    case 'higgsfield':
    case 'seedream4':
      return <ImageIcon />;
    case 'elevenlabs':
      return <AudiotrackIcon />;
    case 'textInput':
      return <TextFieldsIcon />;
    case 'imageInput':
      return <ImageIcon />;
    case 'videoInput':
      return <VideoLibraryIcon />;
    default:
      return <InputIcon />;
  }
}

// ノードタイプの表示名を取得
function getNodeTypeName(type: string): string {
  switch (type) {
    case 'gemini':
      return 'Gemini AI';
    case 'nanobana':
      return 'Nanobana (画像生成)';
    case 'higgsfield':
      return 'Higgsfield (動画生成)';
    case 'seedream4':
      return 'Seedream4 (動画生成)';
    case 'elevenlabs':
      return 'ElevenLabs (音声生成)';
    case 'textInput':
      return 'テキスト入力';
    case 'imageInput':
      return '画像入力';
    case 'videoInput':
      return '動画入力';
    default:
      return type;
  }
}

export default function NodeExecutionCard({
  node,
  output,
  request,
  status,
  error,
  canExecute = false,
  onExecute,
  stepId,
  onInputsEdit,
  workflowInputs = {},
}: NodeExecutionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleExecute = async () => {
    if (!onExecute || executing) return;

    setExecuting(true);
    try {
      await onExecute(node.id);
    } catch (error) {
      console.error('Failed to execute node:', error);
    } finally {
      setExecuting(false);
    }
  };

  const handleSaveInputs = async (inputs: Record<string, any>) => {
    if (!onInputsEdit) return;

    try {
      await onInputsEdit(node.id, inputs);
    } catch (error) {
      console.error('Failed to save inputs:', error);
      throw error;
    }
  };

  // このノードに関連するワークフロー入力をフィルタリング
  const getRelatedWorkflowInputs = () => {
    const nodeType = node.data.type;
    const nodeIdPrefix = `${nodeType}_`;
    const related: Record<string, any> = {};

    Object.entries(workflowInputs).forEach(([key, value]) => {
      // このノードIDを含むキーのみを抽出
      // 例: "gemini_prompt_node-123" -> node.id が "node-123" の場合
      if (key.includes(`_${node.id}`)) {
        // キーから "_nodeId" 部分を削除してフィールド名のみを表示
        const fieldName = key.replace(`_${node.id}`, '').replace(`${nodeType}_`, '');
        related[fieldName] = value;
      }
    });

    return related;
  };

  const relatedWorkflowInputs = getRelatedWorkflowInputs();

  const getStatusIcon = () => {
    switch (status) {
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
    switch (status) {
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
    switch (status) {
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

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 1,
        borderLeft: 4,
        borderLeftColor:
          status === 'completed' ? 'success.main' :
          status === 'running' ? 'info.main' :
          status === 'failed' ? 'error.main' :
          'grey.300',
      }}
    >
      <CardHeader
        avatar={
          <Avatar sx={{ bgcolor: 'primary.light' }}>
            {getNodeTypeIcon(node.data.type)}
          </Avatar>
        }
        title={node.data.label || node.id}
        subheader={getNodeTypeName(node.data.type)}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* 実行ボタン */}
            {status === 'pending' && canExecute && onExecute && (
              <Button
                size="small"
                variant="contained"
                color="primary"
                startIcon={executing ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                onClick={handleExecute}
                disabled={executing}
                sx={{ minWidth: 80 }}
              >
                {executing ? '実行中' : '実行'}
              </Button>
            )}

            {/* ステータスチップ */}
            <Chip
              icon={getStatusIcon()}
              label={getStatusLabel()}
              color={getStatusColor()}
              size="small"
              variant="outlined"
            />

            {/* 展開ボタン */}
            <IconButton size="small" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        }
        sx={{ pb: 1 }}
      />

      <Collapse in={expanded}>
        <CardContent sx={{ pt: 0 }}>
          {/* ワークフロー入力セクション */}
          {Object.keys(relatedWorkflowInputs).length > 0 && (
            <Box mb={2}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                ワークフロー入力（読み取り専用）
              </Typography>
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: 'info.50',
                  borderRadius: 1,
                  border: 1,
                  borderColor: 'info.200',
                }}
              >
                {Object.entries(relatedWorkflowInputs).map(([key, value]) => (
                  <Box key={key} sx={{ mb: 1, '&:last-child': { mb: 0 } }}>
                    <Typography variant="caption" fontWeight={600} color="text.secondary" display="block">
                      {key}:
                    </Typography>
                    {/* 画像データの場合 */}
                    {value && typeof value === 'object' && value.mimeType && value.data ? (
                      <Box sx={{ mt: 0.5 }}>
                        <img
                          src={`data:${value.mimeType};base64,${value.data}`}
                          alt={key}
                          style={{ maxWidth: '150px', maxHeight: '100px', objectFit: 'contain', borderRadius: '4px' }}
                        />
                      </Box>
                    ) : /* 画像配列の場合 */
                    Array.isArray(value) && value.length > 0 && value[0].mimeType && value[0].data ? (
                      <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {value.map((img: any, idx: number) => (
                          <img
                            key={idx}
                            src={`data:${img.mimeType};base64,${img.data}`}
                            alt={`${key}-${idx}`}
                            style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }}
                          />
                        ))}
                      </Box>
                    ) : /* その他のデータ */
                    (
                      <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap', fontSize: '0.75rem' }}>
                        {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* ノード入力データ表示 */}
          {request && (
            <Box mb={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  ノード入力（編集可能）
                </Typography>
                {onInputsEdit && (
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => setEditDialogOpen(true)}
                    variant="outlined"
                  >
                    編集
                  </Button>
                )}
              </Box>
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: 'grey.50',
                  borderRadius: 1,
                  border: 1,
                  borderColor: 'grey.200',
                }}
              >
                <pre style={{ margin: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(request, null, 2)}
                </pre>
              </Box>
            </Box>
          )}

          {/* 出力データ表示 */}
          {output && (
            <Box>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                実行結果
              </Typography>
              <OutputDataDisplay output={output} nodeType={node.data.type} />
            </Box>
          )}

          {/* エラー表示 */}
          {error && (
            <Box mt={2}>
              <Typography variant="subtitle2" fontWeight={600} color="error" gutterBottom>
                エラー
              </Typography>
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: 'error.50',
                  borderRadius: 1,
                  border: 1,
                  borderColor: 'error.200',
                }}
              >
                <Typography variant="body2" color="error">
                  {error}
                </Typography>
              </Box>
            </Box>
          )}

          {/* 出力もエラーもない場合 */}
          {!output && !error && status === 'pending' && (
            <Typography variant="body2" color="text.secondary">
              このノードはまだ実行されていません
            </Typography>
          )}
        </CardContent>
      </Collapse>

      {/* 入力編集ダイアログ */}
      <NodeInputEditDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        onSave={handleSaveInputs}
        nodeType={node.data.type}
        nodeId={node.id}
        currentInputs={request || {}}
      />
    </Card>
  );
}
