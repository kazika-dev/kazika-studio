'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Paper, Box, Typography, IconButton, CircularProgress, Tooltip } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

interface NanobanaNodeData {
  label: string;
  type: 'nanobana';
  config: {
    name: string;
    description: string;
    prompt: string;
    aspectRatio?: string;
    imageData?: {
      mimeType: string;
      data: string;
    };
    status?: 'idle' | 'loading' | 'success' | 'error';
    error?: string;
  };
}

function NanobanaNode({ data, selected, id }: NodeProps<NanobanaNodeData>) {
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
      const response = await fetch('/api/nanobana', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: data.config.prompt,
          aspectRatio: data.config.aspectRatio || '1:1',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate image');
      }

      // 成功時の状態更新
      const successEvent = new CustomEvent('update-node', {
        detail: {
          id,
          updates: {
            config: {
              ...data.config,
              status: 'success',
              imageData: result.imageData,
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
        borderColor: selected ? '#ff6b9d' : 'divider',
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
          backgroundColor: '#ff6b9d',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      />

      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mb: 1 }}>
        <Box
          sx={{
            p: 1,
            borderRadius: 1.5,
            bgcolor: 'rgba(255, 107, 157, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ImageIcon sx={{ fontSize: 20, color: '#ff6b9d' }} />
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
                bgcolor: '#ff6b9d',
                color: 'white',
                '&:hover': {
                  bgcolor: '#ff4081',
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

      {data.config.imageData && (
        <Box
          sx={{
            mt: 1,
            borderRadius: 1,
            overflow: 'hidden',
            maxHeight: 150,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            bgcolor: 'action.hover',
          }}
        >
          <img
            src={`data:${data.config.imageData.mimeType};base64,${data.config.imageData.data}`}
            alt="Generated"
            style={{
              maxWidth: '100%',
              maxHeight: '150px',
              objectFit: 'contain',
            }}
          />
        </Box>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 12,
          height: 12,
          backgroundColor: '#ff6b9d',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      />
    </Paper>
  );
}

export default memo(NanobanaNode);
