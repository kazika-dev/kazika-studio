'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Paper, Box, Typography, IconButton, CircularProgress, Tooltip } from '@mui/material';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

interface HiggsfieldNodeData {
  label: string;
  type: 'higgsfield';
  config: {
    name: string;
    description: string;
    prompt: string;
    duration?: number;
    cfgScale?: number;
    enhancePrompt?: boolean;
    negativePrompt?: string;
    videoUrl?: string;
    status?: 'idle' | 'loading' | 'success' | 'error';
    error?: string;
  };
}

function HiggsfieldNode({ data, selected, id }: NodeProps<HiggsfieldNodeData>) {
  const [isExecuting, setIsExecuting] = useState(false);

  const handleExecute = async () => {
    if (!data.config.prompt) {
      alert('プロンプトを設定してください');
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
      const response = await fetch('/api/higgsfield', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: data.config.prompt,
          duration: data.config.duration || 5,
          cfgScale: data.config.cfgScale || 0.5,
          enhancePrompt: data.config.enhancePrompt || false,
          negativePrompt: data.config.negativePrompt || '',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate video');
      }

      // 成功時の状態更新
      const successEvent = new CustomEvent('update-node', {
        detail: {
          id,
          updates: {
            config: {
              ...data.config,
              status: 'success',
              videoUrl: result.videoUrl,
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
        borderColor: selected ? '#9c27b0' : 'divider',
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
          backgroundColor: '#9c27b0',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      />

      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mb: 1 }}>
        <Box
          sx={{
            p: 1,
            borderRadius: 1.5,
            bgcolor: 'rgba(156, 39, 176, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <VideoLibraryIcon sx={{ fontSize: 20, color: '#9c27b0' }} />
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
                bgcolor: '#9c27b0',
                color: 'white',
                '&:hover': {
                  bgcolor: '#7b1fa2',
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

      {data.config.prompt && (
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
          {data.config.prompt}
        </Typography>
      )}

      {/* 動画設定の表示 */}
      {(data.config.duration || data.config.cfgScale) && (
        <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {data.config.duration && (
            <Typography
              variant="caption"
              sx={{
                px: 1,
                py: 0.5,
                bgcolor: 'rgba(156, 39, 176, 0.1)',
                borderRadius: 1,
                fontSize: '0.65rem',
                color: '#9c27b0',
              }}
            >
              {data.config.duration}秒
            </Typography>
          )}
          {data.config.cfgScale !== undefined && (
            <Typography
              variant="caption"
              sx={{
                px: 1,
                py: 0.5,
                bgcolor: 'rgba(156, 39, 176, 0.1)',
                borderRadius: 1,
                fontSize: '0.65rem',
                color: '#9c27b0',
              }}
            >
              CFG: {data.config.cfgScale}
            </Typography>
          )}
        </Box>
      )}

      {/* 動画プレビュー */}
      {data.config.videoUrl && (
        <Box
          sx={{
            mt: 1,
            borderRadius: 1,
            overflow: 'hidden',
            bgcolor: 'action.hover',
          }}
        >
          <video
            controls
            style={{ width: '100%', maxHeight: '150px' }}
            src={data.config.videoUrl}
          />
        </Box>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 12,
          height: 12,
          backgroundColor: '#9c27b0',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      />
    </Paper>
  );
}

export default memo(HiggsfieldNode);
