'use client';

import { Box } from '@mui/material';
import { TimelineBoard } from './boardTypes';
import BoardBlock from './BoardBlock';
import { useState } from 'react';

interface BoardTimelineTrackProps {
  boards: TimelineBoard[];
  zoomLevel: number;
  totalDuration: number;
  selectedBoardId: number | null;
  snapEnabled: boolean;
  onBoardSelect: (boardId: number) => void;
  onBoardMove: (boardId: number, newStart: number) => void;
  onBoardResize: (boardId: number, newDuration: number) => void;
}

export default function BoardTimelineTrack({
  boards,
  zoomLevel,
  totalDuration,
  selectedBoardId,
  snapEnabled,
  onBoardSelect,
  onBoardMove,
  onBoardResize,
}: BoardTimelineTrackProps) {
  const [resizingHandle, setResizingHandle] = useState<'left' | 'right' | null>(null);
  const [resizingBoardId, setResizingBoardId] = useState<number | null>(null);

  const trackHeight = 140;

  // スナップ機能
  const snapToGrid = (time: number): number => {
    if (!snapEnabled) return time;

    const snapThreshold = 0.5; // 0.5秒以内でスナップ

    // 他のボードの境界を取得
    const snapPoints = boards.flatMap((b) => [
      b.timeline_start,
      b.timeline_start + b.timeline_duration,
    ]);

    // 最も近いスナップポイントを探す
    for (const point of snapPoints) {
      if (Math.abs(time - point) < snapThreshold) {
        return point;
      }
    }

    return time;
  };

  // ボード移動
  const handleBoardMove = (boardId: number, deltaX: number) => {
    const board = boards.find((b) => b.id === boardId);
    if (!board) return;

    const deltaTime = deltaX / zoomLevel;
    let newStart = Number(board.timeline_start) + deltaTime;
    newStart = Math.max(0, Math.min(newStart, totalDuration - Number(board.timeline_duration)));
    newStart = snapToGrid(newStart);

    onBoardMove(boardId, newStart);
  };

  // リサイズ開始
  const handleResizeStart = (boardId: number, handle: 'left' | 'right') => {
    setResizingHandle(handle);
    setResizingBoardId(boardId);
  };

  // リサイズ移動
  const handleResizeMove = (boardId: number, deltaX: number) => {
    const board = boards.find((b) => b.id === boardId);
    if (!board) return;

    const deltaTime = deltaX / zoomLevel;

    // 右端のみリサイズ可能（左端は固定）
    if (resizingHandle === 'right') {
      let newDuration = Number(board.timeline_duration) + deltaTime;
      newDuration = Math.max(1, Math.min(newDuration, totalDuration - Number(board.timeline_start)));

      // スナップが有効な場合、1秒単位にスナップ
      if (snapEnabled) {
        newDuration = Math.round(newDuration);
      }

      onBoardResize(boardId, newDuration);
    }
  };

  // リサイズ終了
  const handleResizeEnd = () => {
    setResizingHandle(null);
    setResizingBoardId(null);
  };

  const totalWidth = totalDuration * zoomLevel;

  return (
    <Box
      sx={{
        position: 'relative',
        height: trackHeight,
        width: totalWidth,
        bgcolor: '#252525',
        borderBottom: '1px solid #424242',
      }}
    >
      {/* グリッド線 */}
      {snapEnabled && (
        <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
          {Array.from({ length: Math.ceil(totalDuration / 5) }).map((_, i) => {
            const x = i * 5 * zoomLevel;
            return (
              <Box
                key={i}
                sx={{
                  position: 'absolute',
                  left: x,
                  top: 0,
                  width: 1,
                  height: '100%',
                  bgcolor: '#3a3a3a',
                  opacity: 0.3,
                }}
              />
            );
          })}
        </Box>
      )}

      {/* ボードブロック */}
      {boards.map((board) => (
        <Box
          key={board.id}
          sx={{
            position: 'absolute',
            left: Number(board.timeline_start) * zoomLevel,
            top: 8,
            height: trackHeight - 16,
          }}
        >
          <BoardBlock
            board={board}
            zoomLevel={zoomLevel}
            isSelected={selectedBoardId === board.id}
            onSelect={() => onBoardSelect(board.id)}
            onMove={(deltaX) => handleBoardMove(board.id, deltaX)}
            onResizeStart={(handle) => handleResizeStart(board.id, handle)}
            onResizeMove={(deltaX) => handleResizeMove(board.id, deltaX)}
            onResizeEnd={handleResizeEnd}
          />
        </Box>
      ))}
    </Box>
  );
}
