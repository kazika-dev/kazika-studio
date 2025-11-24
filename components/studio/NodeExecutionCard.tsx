'use client';

import { useState } from 'react';
import {
  Box,
  Card,
  CardHeader,
  CardContent,
  Collapse,
  IconButton,
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

import OutputDataDisplay from './OutputDataDisplay';

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
}: NodeExecutionCardProps) {
  const [expanded, setExpanded] = useState(false);

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
            <Chip
              icon={getStatusIcon()}
              label={getStatusLabel()}
              color={getStatusColor()}
              size="small"
              variant="outlined"
            />
            <IconButton size="small" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        }
        sx={{ pb: 1 }}
      />

      <Collapse in={expanded}>
        <CardContent sx={{ pt: 0 }}>
          {/* 入力データ表示 */}
          {request && (
            <Box mb={2}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                入力
              </Typography>
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
                出力
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
    </Card>
  );
}
