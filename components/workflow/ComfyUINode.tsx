'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Paper, Box, Typography, IconButton, CircularProgress, Tooltip, Chip } from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

interface ComfyUINodeData {
  label: string;
  type: 'comfyui';
  config: {
    name: string;
    description: string;
    workflowName: string; // ComfyUI workflow name
    workflowJson?: any; // ComfyUI workflow definition
    prompt?: string;
    queueItemId?: number; // ID in comfyui_queue table
    imageData?: {
      mimeType: string;
      data: string;
    };
    status?: 'idle' | 'queued' | 'processing' | 'success' | 'error';
    error?: string;
  };
}

function ComfyUINode({ data, selected, id }: NodeProps<ComfyUINodeData>) {
  const [isExecuting, setIsExecuting] = useState(false);

  const handleExecute = async () => {
    if (!data.config.workflowName) {
      alert('ComfyUIワークフロー名を設定してください');
      return;
    }

    if (!data.config.workflowJson) {
      alert('ComfyUIワークフロー定義を設定してください');
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
            status: 'queued',
          },
        },
      },
    });
    window.dispatchEvent(updateEvent);

    try {
      const response = await fetch('/api/comfyui/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowName: data.config.workflowName,
          workflowJson: data.config.workflowJson,
          prompt: data.config.prompt || '',
          inputImages: (data.config as any).inputImages || [],
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to queue ComfyUI workflow');
      }

      // キューに追加成功
      const successEvent = new CustomEvent('update-node', {
        detail: {
          id,
          updates: {
            config: {
              ...data.config,
              status: 'queued',
              queueItemId: result.queueItemId,
            },
          },
        },
      });
      window.dispatchEvent(successEvent);

      // ポーリングで結果を待つ
      pollQueueStatus(result.queueItemId);

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
      setIsExecuting(false);
    }
  };

  const pollQueueStatus = async (queueItemId: number) => {
    const maxAttempts = 60; // 5分間（5秒 x 60）
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/comfyui/queue/${queueItemId}`);
        const result = await response.json();

        if (result.status === 'completed') {
          // 完了
          const successEvent = new CustomEvent('update-node', {
            detail: {
              id,
              updates: {
                config: {
                  ...data.config,
                  status: 'success',
                  imageData: result.outputImages?.[0] || null,
                },
              },
            },
          });
          window.dispatchEvent(successEvent);
          setIsExecuting(false);
        } else if (result.status === 'failed') {
          // 失敗
          const errorEvent = new CustomEvent('update-node', {
            detail: {
              id,
              updates: {
                config: {
                  ...data.config,
                  status: 'error',
                  error: result.error_message || 'ComfyUI processing failed',
                },
              },
            },
          });
          window.dispatchEvent(errorEvent);
          setIsExecuting(false);
        } else if (result.status === 'processing') {
          // 処理中の更新
          const processingEvent = new CustomEvent('update-node', {
            detail: {
              id,
              updates: {
                config: {
                  ...data.config,
                  status: 'processing',
                },
              },
            },
          });
          window.dispatchEvent(processingEvent);

          // 再度ポーリング
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(poll, 5000);
          } else {
            throw new Error('Timeout waiting for ComfyUI processing');
          }
        } else {
          // pending or queued - 再度ポーリング
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(poll, 5000);
          } else {
            throw new Error('Timeout waiting for ComfyUI processing');
          }
        }
      } catch (error: any) {
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
        setIsExecuting(false);
      }
    };

    poll();
  };

  const getStatusIcon = () => {
    switch (data.config.status) {
      case 'queued':
        return <HourglassEmptyIcon fontSize="small" color="info" />;
      case 'processing':
        return <CircularProgress size={16} />;
      case 'success':
        return <CheckCircleIcon fontSize="small" color="success" />;
      case 'error':
        return <ErrorIcon fontSize="small" color="error" />;
      default:
        return null;
    }
  };

  const getStatusChip = () => {
    const statusLabels = {
      idle: 'アイドル',
      queued: 'キュー待ち',
      processing: '処理中',
      success: '完了',
      error: 'エラー',
    };

    const statusColors: any = {
      idle: 'default',
      queued: 'info',
      processing: 'warning',
      success: 'success',
      error: 'error',
    };

    return data.config.status ? (
      <Chip
        label={statusLabels[data.config.status] || data.config.status}
        color={statusColors[data.config.status] || 'default'}
        size="small"
      />
    ) : null;
  };

  return (
    <Paper
      elevation={selected ? 8 : 2}
      sx={{
        position: 'relative',
        minWidth: 280,
        p: 2,
        border: selected ? '2px solid' : '1px solid',
        borderColor: selected ? '#4caf50' : 'divider',
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
          backgroundColor: '#4caf50',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      />

      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mb: 1 }}>
        <Box
          sx={{
            p: 1,
            borderRadius: 1.5,
            bgcolor: 'rgba(76, 175, 80, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AccountTreeIcon sx={{ fontSize: 20, color: '#4caf50' }} />
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
          <Tooltip title="キューに追加して実行">
            <IconButton
              size="small"
              onClick={handleExecute}
              disabled={isExecuting}
              sx={{
                bgcolor: '#4caf50',
                color: 'white',
                '&:hover': {
                  bgcolor: '#45a049',
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

      {getStatusChip()}

      {data.config.workflowName && (
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
          }}
        >
          Workflow: {data.config.workflowName}
        </Typography>
      )}

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
            alt="Output"
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
          backgroundColor: '#4caf50',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      />
    </Paper>
  );
}

export default memo(ComfyUINode);
