'use client';

import { Box, Typography, Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PendingIcon from '@mui/icons-material/Pending';
import { TimelineStep, TRACK_COLORS } from './types';
import { useState, useRef, useEffect } from 'react';

interface TimelineStepBlockProps {
  step: TimelineStep;
  zoomLevel: number;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (deltaX: number, deltaY: number) => void;
  onResizeStart: (handle: 'left' | 'right') => void;
  onResizeMove: (deltaX: number) => void;
  onResizeEnd: () => void;
}

export default function TimelineStepBlock({
  step,
  zoomLevel,
  isSelected,
  onSelect,
  onMove,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
}: TimelineStepBlockProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const blockRef = useRef<HTMLDivElement>(null);

  const width = step.timeline_duration * zoomLevel;
  const minWidth = 20; // 最小幅

  // ステータスアイコン
  const getStatusIcon = () => {
    switch (step.execution_status) {
      case 'completed':
        return <CheckCircleIcon fontSize="small" sx={{ color: '#4caf50' }} />;
      case 'failed':
        return <ErrorIcon fontSize="small" sx={{ color: '#f44336' }} />;
      case 'pending':
      default:
        return <PendingIcon fontSize="small" sx={{ color: '#757575' }} />;
    }
  };

  // サムネイル画像の取得
  const getThumbnail = () => {
    if (step.output_data?.imageUrl) {
      return step.output_data.imageUrl;
    }
    if (step.output_data?.imageData) {
      return `data:${step.output_data.imageData.mimeType};base64,${step.output_data.imageData.data}`;
    }
    return null;
  };

  // ドラッグ開始
  const handleMouseDown = (e: React.MouseEvent) => {
    // リサイズハンドル上でのクリックは無視
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
        const deltaY = e.clientY - dragStart.y;
        onMove(deltaX, deltaY);
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

  const thumbnail = getThumbnail();
  const trackColor = TRACK_COLORS[step.timeline_track] || '#666';

  return (
    <Box
      ref={blockRef}
      onMouseDown={handleMouseDown}
      sx={{
        position: 'relative',
        width: Math.max(width, minWidth),
        height: '100%',
        bgcolor: trackColor,
        borderRadius: 1,
        border: isSelected ? '2px solid #0d47a1' : '1px solid rgba(255,255,255,0.2)',
        boxShadow: isSelected
          ? '0 4px 8px rgba(0,0,0,0.5)'
          : '0 2px 4px rgba(0,0,0,0.3)',
        cursor: isDragging ? 'grabbing' : 'grab',
        overflow: 'hidden',
        userSelect: 'none',
        opacity: step.execution_status === 'failed' ? 0.7 : 1,
        '&:hover': {
          boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
          '& .resize-handle': {
            opacity: 1,
          },
        },
      }}
    >
      {/* サムネイル */}
      {thumbnail && width > 60 && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 40,
            height: '100%',
            backgroundImage: `url(${thumbnail})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.6,
            borderRight: '1px solid rgba(255,255,255,0.2)',
          }}
        />
      )}

      {/* コンテンツ */}
      <Box
        sx={{
          position: 'relative',
          p: 1,
          pl: thumbnail && width > 60 ? 5 : 1,
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
                fontWeight: 600,
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {step.workflow_name || `Step ${step.step_order + 1}`}
            </Typography>
          )}
          {width > 150 && (
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: '0.65rem',
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {step.timeline_duration.toFixed(1)}s
            </Typography>
          )}
        </Box>

        {/* フッター */}
        {width > 80 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {getStatusIcon()}
          </Box>
        )}
      </Box>

      {/* 左リサイズハンドル */}
      <Box
        className="resize-handle"
        onMouseDown={(e) => handleResizeMouseDown(e, 'left')}
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 8,
          height: '100%',
          cursor: 'ew-resize',
          bgcolor: 'rgba(255,255,255,0.2)',
          opacity: 0,
          transition: 'opacity 0.2s',
          zIndex: 2,
          '&:hover': {
            bgcolor: 'rgba(255,255,255,0.4)',
          },
        }}
      />

      {/* 右リサイズハンドル */}
      <Box
        className="resize-handle"
        onMouseDown={(e) => handleResizeMouseDown(e, 'right')}
        sx={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: 8,
          height: '100%',
          cursor: 'ew-resize',
          bgcolor: 'rgba(255,255,255,0.2)',
          opacity: 0,
          transition: 'opacity 0.2s',
          zIndex: 2,
          '&:hover': {
            bgcolor: 'rgba(255,255,255,0.4)',
          },
        }}
      />
    </Box>
  );
}
