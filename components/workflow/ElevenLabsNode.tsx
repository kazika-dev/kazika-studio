'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Paper, Box, Typography, IconButton, CircularProgress, Tooltip } from '@mui/material';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

interface ElevenLabsNodeData {
  label: string;
  type: 'elevenlabs';
  config: {
    name: string;
    description: string;
    text: string;
    voiceId: string;
    modelId: string;
    audioData?: { mimeType: string; data: string };
    status?: 'idle' | 'loading' | 'success' | 'error';
    error?: string;
  };
}

function ElevenLabsNode({ data, selected, id }: NodeProps<ElevenLabsNodeData>) {
  const [isExecuting, setIsExecuting] = useState(false);

  const handleExecute = async () => {
    if (!data.config.text) {
      alert('テキストを設定してください');
      return;
    }

    setIsExecuting(true);

    // ノードの状態を更新するためのカスタムイベントを発火
    const updateEvent = new CustomEvent('update-node', {
      detail: {
        id,
        updates: {
          config: {
            ...data.config,
            status: 'loading',
          },
        },
      },
    });
    window.dispatchEvent(updateEvent);

    try {
      const response = await fetch('/api/elevenlabs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: data.config.text,
          voiceId: data.config.voiceId || 'JBFqnCBsd6RMkjVDRZzb',
          modelId: data.config.modelId || 'eleven_multilingual_v2',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate speech');
      }

      // 成功時の状態更新
      const successEvent = new CustomEvent('update-node', {
        detail: {
          id,
          updates: {
            config: {
              ...data.config,
              status: 'success',
              audioData: result.audioData,
            },
          },
        },
      });
      window.dispatchEvent(successEvent);
    } catch (error: any) {
      // エラー時の状態更新
      const errorEvent = new CustomEvent('update-node', {
        detail: {
          id,
          updates: {
            config: {
              ...data.config,
              status: 'error',
              error: error.message,
            },
          },
        },
      });
      window.dispatchEvent(errorEvent);
    } finally {
      setIsExecuting(false);
    }
  };

  const getStatusIcon = () => {
    switch (data.config.status) {
      case 'loading':
        return <CircularProgress size={16} />;
      case 'success':
        return <CheckCircleIcon fontSize="small" color="success" />;
      case 'error':
        return <ErrorIcon fontSize="small" color="error" />;
      default:
        return null;
    }
  };

  return (
    <Paper
      elevation={selected ? 8 : 2}
      sx={{
        position: 'relative',
        minWidth: 280,
        p: 2,
        border: selected ? '2px solid' : '1px solid',
        borderColor: selected ? '#4fc3f7' : 'divider',
        borderRadius: 2,
        transition: 'all 0.3s ease',
        bgcolor: 'background.paper',
        '&:hover': {
          elevation: 4,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 12,
          height: 12,
          backgroundColor: '#4fc3f7',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      />

      {/* 音声ID入力ハンドル */}
      <Handle
        type="target"
        position={Position.Left}
        id="voiceId"
        style={{
          top: '30%',
          width: 10,
          height: 10,
          backgroundColor: '#ff9800',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      />

      {/* モデル入力ハンドル */}
      <Handle
        type="target"
        position={Position.Left}
        id="modelId"
        style={{
          top: '50%',
          width: 10,
          height: 10,
          backgroundColor: '#9c27b0',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      />

      {/* テキスト入力ハンドル */}
      <Handle
        type="target"
        position={Position.Left}
        id="text"
        style={{
          top: '70%',
          width: 10,
          height: 10,
          backgroundColor: '#4caf50',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      />

      {/* 入力ハンドルラベル */}
      <Box sx={{ position: 'absolute', left: 12, top: 'calc(30% - 8px)' }}>
        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#ff9800', fontWeight: 500 }}>
          音声ID
        </Typography>
      </Box>
      <Box sx={{ position: 'absolute', left: 12, top: 'calc(50% - 8px)' }}>
        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#9c27b0', fontWeight: 500 }}>
          モデル
        </Typography>
      </Box>
      <Box sx={{ position: 'absolute', left: 12, top: 'calc(70% - 8px)' }}>
        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#4caf50', fontWeight: 500 }}>
          テキスト
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mb: 1 }}>
        <Box
          sx={{
            p: 1,
            borderRadius: 1.5,
            bgcolor: 'rgba(79, 195, 247, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <RecordVoiceOverIcon sx={{ fontSize: 20, color: '#4fc3f7' }} />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              mb: 0.5,
              lineHeight: 1.3,
            }}
          >
            {data.config.name}
          </Typography>
          {data.config.description && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: 1.4,
              }}
            >
              {data.config.description}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {getStatusIcon()}
          <Tooltip title="実行">
            <IconButton
              size="small"
              onClick={handleExecute}
              disabled={isExecuting}
              sx={{
                bgcolor: '#4fc3f7',
                color: 'white',
                '&:hover': {
                  bgcolor: '#29b6f6',
                },
                '&:disabled': {
                  bgcolor: 'action.disabledBackground',
                },
              }}
            >
              <PlayArrowIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {data.config.text && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 1,
            p: 1,
            bgcolor: 'action.hover',
            borderRadius: 1,
            color: 'text.secondary',
            fontSize: '0.7rem',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {data.config.text}
        </Typography>
      )}

      {/* 音声プレビュー */}
      {data.config.audioData && (
        <Box sx={{ mt: 1 }}>
          <audio
            controls
            style={{ width: '100%', height: '32px' }}
            src={`data:${data.config.audioData.mimeType};base64,${data.config.audioData.data}`}
          />
        </Box>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 12,
          height: 12,
          backgroundColor: '#4fc3f7',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      />
    </Paper>
  );
}

export default memo(ElevenLabsNode);
