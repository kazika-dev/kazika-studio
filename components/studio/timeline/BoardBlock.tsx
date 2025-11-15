'use client';

import { Box, Typography, Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PendingIcon from '@mui/icons-material/Pending';
import { TimelineBoard, BOARD_STATUS_COLORS } from './boardTypes';
import { useState, useRef, useEffect, useMemo } from 'react';

interface BoardBlockProps {
  board: TimelineBoard;
  zoomLevel: number;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (deltaX: number) => void;
  onResizeStart: (handle: 'left' | 'right') => void;
  onResizeMove: (deltaX: number) => void;
  onResizeEnd: () => void;
}

export default function BoardBlock({
  board,
  zoomLevel,
  isSelected,
  onSelect,
  onMove,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
}: BoardBlockProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const blockRef = useRef<HTMLDivElement>(null);

  const width = Number(board.timeline_duration) * zoomLevel;
  const minWidth = 60; // 最小幅（1秒 @ 60px/s）

  // ステータスアイコン
  const getStatusIcon = () => {
    switch (board.status) {
      case 'completed':
        return <CheckCircleIcon fontSize="small" sx={{ color: BOARD_STATUS_COLORS.completed }} />;
      case 'error':
        return <ErrorIcon fontSize="small" sx={{ color: BOARD_STATUS_COLORS.error }} />;
      case 'processing':
        return <PendingIcon fontSize="small" sx={{ color: BOARD_STATUS_COLORS.processing }} />;
      default:
        return <PendingIcon fontSize="small" sx={{ color: BOARD_STATUS_COLORS.draft }} />;
    }
  };

  // 最後のWorkflowStepの出力からサムネイルを取得
  const getThumbnail = useMemo(() => {
    const steps = board.workflow_steps || [];
    const completedSteps = steps
      .filter((s) => s.execution_status === 'completed')
      .sort((a, b) => b.step_order - a.step_order);

    const lastStep = completedSteps[0];
    if (!lastStep) return null;

    if (lastStep.output_data?.imageUrl) {
      return lastStep.output_data.imageUrl;
    }
    if (lastStep.output_data?.imageData) {
      return `data:${lastStep.output_data.imageData.mimeType};base64,${lastStep.output_data.imageData.data}`;
    }
    if (lastStep.output_data?.videoUrl) {
      return lastStep.output_data.videoUrl;
    }

    return null;
  }, [board.workflow_steps]);

  // WorkflowStepsの状態サマリー
  const getStepsStatus = useMemo(() => {
    const steps = board.workflow_steps || [];
    if (steps.length === 0) return 'ステップなし';

    const completed = steps.filter((s) => s.execution_status === 'completed').length;
    const failed = steps.filter((s) => s.execution_status === 'failed').length;
    const running = steps.filter((s) => s.execution_status === 'running').length;

    const parts = [];
    if (completed > 0) parts.push(`${completed}✓`);
    if (running > 0) parts.push(`${running}▶`);
    if (failed > 0) parts.push(`${failed}✗`);

    return `${steps.length} steps: ${parts.join(' ')}`;
  }, [board.workflow_steps]);

  // ドラッグ開始
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('resize-handle')) {
      return;
    }

    e.stopPropagation();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    onSelect();
  };

  // リサイズハンドルのマウスダウン
  const handleResizeMouseDown = (e: React.MouseEvent, handle: 'left' | 'right') => {
    e.stopPropagation();
    setIsResizing(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    onResizeStart(handle);
  };

  // マウス移動
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStart.x;
        onMove(deltaX);
        setDragStart({ x: e.clientX, y: e.clientY });
      } else if (isResizing) {
        const deltaX = e.clientX - dragStart.x;
        onResizeMove(deltaX);
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        onResizeEnd();
      }
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, onMove, onResizeMove, onResizeEnd]);

  const statusColor = BOARD_STATUS_COLORS[board.status] || BOARD_STATUS_COLORS.draft;

  return (
    <Box
      ref={blockRef}
      onMouseDown={handleMouseDown}
      sx={{
        position: 'relative',
        width: Math.max(width, minWidth),
        height: '100%',
        background: `linear-gradient(135deg, ${statusColor}ee 0%, ${statusColor}aa 100%)`,
        borderRadius: 2,
        border: isSelected ? '3px solid #0d47a1' : '2px solid rgba(255,255,255,0.1)',
        boxShadow: isSelected
          ? '0 4px 12px rgba(0,0,0,0.5)'
          : '0 2px 8px rgba(0,0,0,0.3)',
        cursor: isDragging ? 'grabbing' : 'grab',
        overflow: 'hidden',
        userSelect: 'none',
        opacity: board.status === 'draft' ? 0.7 : 1,
        animation: board.status === 'processing' ? 'pulse 2s infinite' : 'none',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          borderColor: isSelected ? '#0d47a1' : 'rgba(255,255,255,0.3)',
          '& .resize-handle': {
            opacity: 1,
          },
        },
        '@keyframes pulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.7 },
        },
      }}
    >
      {/* サムネイル */}
      {getThumbnail && width > 80 && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: width > 150 ? 80 : 60,
            backgroundImage: `url(${getThumbnail})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.6,
            borderBottom: '1px solid rgba(255,255,255,0.2)',
          }}
        />
      )}

      {/* コンテンツ */}
      <Box
        sx={{
          position: 'relative',
          p: 1.5,
          pt: getThumbnail && width > 80 ? (width > 150 ? 10 : 8) : 1.5,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* ヘッダー */}
        <Box>
          {width > 100 && (
            <Typography
              variant="caption"
              sx={{
                color: 'white',
                fontWeight: 700,
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
              }}
            >
              {board.title || `シーン ${board.sequence_order + 1}`}
            </Typography>
          )}
          {width > 120 && (
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: '0.7rem',
                display: 'block',
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
              }}
            >
              ⏱ {Number(board.timeline_duration).toFixed(1)}s
            </Typography>
          )}
        </Box>

        {/* フッター */}
        {width > 100 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {/* WorkflowStepsステータス */}
            {width > 150 && (
              <Typography
                variant="caption"
                sx={{
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: '0.65rem',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                }}
              >
                {getStepsStatus}
              </Typography>
            )}
            {/* ボードステータス */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {getStatusIcon()}
              {width > 130 && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'white',
                    fontSize: '0.7rem',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                  }}
                >
                  {board.status === 'completed' ? '完了' :
                   board.status === 'processing' ? '処理中' :
                   board.status === 'error' ? 'エラー' : '下書き'}
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* トランジションインジケーター */}
      {board.transition_to_next && board.transition_to_next.type !== 'none' && width > 120 && (
        <Box
          sx={{
            position: 'absolute',
            right: -30,
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#9e9e9e',
            fontSize: '0.7rem',
            textAlign: 'center',
            width: 60,
          }}
        >
          <Typography variant="caption" sx={{ fontSize: '0.65rem', display: 'block' }}>
            ↓
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>
            {board.transition_to_next.type}
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '0.55rem' }}>
            {board.transition_to_next.duration}s
          </Typography>
        </Box>
      )}

      {/* リサイズハンドル（右のみ） */}
      <Box
        className="resize-handle"
        onMouseDown={(e) => handleResizeMouseDown(e, 'right')}
        sx={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: 10,
          height: '100%',
          cursor: 'ew-resize',
          bgcolor: 'rgba(255,255,255,0.3)',
          opacity: 0,
          transition: 'opacity 0.2s',
          zIndex: 2,
          '&:hover': {
            bgcolor: 'rgba(255,255,255,0.5)',
          },
        }}
      />
    </Box>
  );
}
