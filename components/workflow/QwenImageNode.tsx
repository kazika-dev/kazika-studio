'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Paper, Box, Typography, IconButton, CircularProgress, Tooltip, Chip, LinearProgress } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

interface QwenImageNodeData {
  label: string;
  type: 'qwen_image';
  config: {
    name: string;
    description: string;
    prompt: string;
    queueItemId?: number; // ID in comfyui_queues table
    imageUrl?: string; // GCP Storage signed URL
    status?: 'idle' | 'queued' | 'processing' | 'success' | 'error';
    error?: string;
  };
}

function QwenImageNode({ data, selected, id }: NodeProps<QwenImageNodeData>) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [pollingCount, setPollingCount] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  const handleExecute = async () => {
    if (!data.config.prompt || !data.config.prompt.trim()) {
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
            status: 'queued',
          },
        },
      },
    });
    window.dispatchEvent(updateEvent);

    try {
      const response = await fetch('/api/qwen-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: data.config.prompt,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate image with Qwen');
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
    const startTime = Date.now();

    const poll = async () => {
      try {
        attempts++;
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setPollingCount(attempts);
        setElapsedTime(elapsed);

        const response = await fetch(`/api/qwen-image/${queueItemId}`);
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
                  imageUrl: result.imageUrl || null,
                },
              },
            },
          });
          window.dispatchEvent(successEvent);
          setIsExecuting(false);
          setPollingCount(0);
          setElapsedTime(0);
        } else if (result.status === 'failed') {
          // 失敗
          const errorEvent = new CustomEvent('update-node', {
            detail: {
              id,
              updates: {
                config: {
                  ...data.config,
                  status: 'error',
                  error: result.error_message || 'Qwen Image processing failed',
                },
              },
            },
          });
          window.dispatchEvent(errorEvent);
          setIsExecuting(false);
          setPollingCount(0);
          setElapsedTime(0);
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
          if (attempts < maxAttempts) {
            setTimeout(poll, 5000);
          } else {
            throw new Error('Timeout waiting for Qwen Image processing');
          }
        } else {
          // pending or queued - 再度ポーリング
          if (attempts < maxAttempts) {
            setTimeout(poll, 5000);
          } else {
            throw new Error('Timeout waiting for Qwen Image processing');
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
        setPollingCount(0);
        setElapsedTime(0);
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
          <ImageIcon sx={{ fontSize: 20, color: '#9c27b0' }} />
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
          <Tooltip title="画像を生成">
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

      {getStatusChip()}

      {/* ポーリング中の進捗表示 */}
      {(data.config.status === 'queued' || data.config.status === 'processing') && isExecuting && (
        <Box sx={{ mt: 1 }}>
          <LinearProgress
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: 'rgba(156, 39, 176, 0.1)',
              '& .MuiLinearProgress-bar': {
                bgcolor: '#9c27b0',
              }
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
              <AccessTimeIcon sx={{ fontSize: 10, mr: 0.5, verticalAlign: 'middle' }} />
              {elapsedTime}秒経過
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
              チェック: {pollingCount}/60
            </Typography>
          </Box>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 0.5,
              color: '#9c27b0',
              fontSize: '0.7rem',
              textAlign: 'center',
              fontWeight: 500,
            }}
          >
            {data.config.status === 'queued' ? '画像生成を待機中...' : '画像を生成中...'}
          </Typography>
        </Box>
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

      {data.config.imageUrl && (
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
            src={data.config.imageUrl}
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
          backgroundColor: '#9c27b0',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      />
    </Paper>
  );
}

export default memo(QwenImageNode);
